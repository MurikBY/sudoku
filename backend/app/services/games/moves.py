import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.schemas.preferences import GameAssistsPayload
from app.services.game_events import append_game_event
from app.services.games.board_notes import (
    clear_cell_notes,
    copy_notes_map,
    remove_digit_from_peer_notes,
)
from app.services.games.errors import InvalidMove
from app.services.games.lifecycle import credit_reported_time
from app.services.games.queries import get_game_in_progress
from app.services.games.undo import push_undo_entry
from app.services.lesson_progress_service import record_if_objective_met
from app.services.sudoku.grid import EMPTY_CELL, parse_grid
from app.services.sudoku.validator import is_correct_player_digit, is_move_mistake, validate_move


@dataclass(frozen=True)
class CellMove:
    index: int
    value: int


@dataclass(frozen=True)
class MoveResult:
    game: Game
    is_mistake: bool


async def apply_move(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    move: CellMove,
    elapsed_seconds: int | None,
) -> MoveResult:
    game = await get_game_in_progress(session, user_id, game_id, for_update=True)
    assists = GameAssistsPayload.model_validate(game.assists)
    current_digit = _digit_the_move_replaces(game, assists, move)

    if move.value == current_digit:
        credit_reported_time(game, elapsed_seconds)
        await session.commit()
        return MoveResult(game=game, is_mistake=False)

    notes_before_action = copy_notes_map(game.notes)
    is_mistake = is_move_mistake(move.index, move.value, game.solution)
    _write_digit(game, assists, move, is_mistake)
    push_undo_entry(
        game,
        cell_index=move.index,
        previous_value=current_digit,
        notes_before_action=notes_before_action,
    )
    if is_mistake:
        game.mistakes_count += 1
    credit_reported_time(game, elapsed_seconds)

    await record_if_objective_met(session, game)
    await session.commit()
    return MoveResult(game=game, is_mistake=is_mistake)


def _digit_the_move_replaces(game: Game, assists: GameAssistsPayload, move: CellMove) -> int:
    try:
        validate_move(game.puzzle, game.current_grid, move.index, move.value)
    except ValueError as error:
        raise InvalidMove(str(error)) from error
    current_digit = parse_grid(game.current_grid)[move.index]
    # With mistake feedback on, a correct digit is locked: the player was told it is right.
    if (
        assists.mistake_feedback
        and move.value != current_digit
        and is_correct_player_digit(game.puzzle, game.current_grid, game.solution, move.index)
    ):
        raise InvalidMove("cannot modify correct cell")
    return current_digit


def _write_digit(
    game: Game,
    assists: GameAssistsPayload,
    move: CellMove,
    is_mistake: bool,
) -> None:
    grid_chars = list(game.current_grid)
    grid_chars[move.index] = str(move.value)
    game.current_grid = "".join(grid_chars)
    if move.value == EMPTY_CELL:
        append_game_event(game, "clear", cell=move.index)
        return
    clear_cell_notes(game, move.index)
    peer_notes: dict[str, list[int]] = {}
    # A highlighted mistake keeps the peer marks, so fixing it does not cost the player notes.
    if assists.auto_clear_notes and not (is_mistake and assists.mistake_feedback):
        peer_notes = remove_digit_from_peer_notes(game, move.index, move.value)
    append_game_event(
        game,
        "set",
        cell=move.index,
        value=move.value,
        peer_notes=peer_notes or None,
    )
