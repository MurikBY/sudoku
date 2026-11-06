import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.schemas.preferences import GameAssistsPayload
from app.services.game_events import append_game_event
from app.services.games.board_notes import clear_cell_notes, remove_digit_from_peer_notes
from app.services.games.errors import InvalidMove
from app.services.games.lifecycle import credit_play_time
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
    index = move.index
    value = move.value
    try:
        validate_move(game.puzzle, game.current_grid, index, value)
    except ValueError as error:
        raise InvalidMove(str(error)) from error

    current_digit = parse_grid(game.current_grid)[index]
    if (
        assists.mistake_feedback
        and value != current_digit
        and is_correct_player_digit(
            game.puzzle,
            game.current_grid,
            game.solution,
            index,
        )
    ):
        raise InvalidMove("cannot modify correct cell")

    if value == current_digit:
        if elapsed_seconds is not None:
            credit_play_time(game, elapsed_seconds)
        await session.commit()
        await session.refresh(game)
        return MoveResult(game=game, is_mistake=False)

    push_undo_entry(
        game,
        cell_index=index,
        previous_value=current_digit,
    )
    is_mistake = is_move_mistake(index, value, game.solution)
    grid_chars = list(game.current_grid)
    grid_chars[index] = str(value)
    game.current_grid = "".join(grid_chars)
    if value == EMPTY_CELL:
        append_game_event(game, "clear", cell=index)
    else:
        clear_cell_notes(game, index)
        skip_peer_clear = is_mistake and assists.mistake_feedback
        peer_notes: dict[str, list[int]] = {}
        if assists.auto_clear_notes and not skip_peer_clear:
            peer_notes = remove_digit_from_peer_notes(game, index, value)
        append_game_event(
            game,
            "set",
            cell=index,
            value=value,
            peer_notes=peer_notes or None,
        )
    if is_mistake:
        game.mistakes_count += 1
    if elapsed_seconds is not None:
        credit_play_time(game, elapsed_seconds)

    await record_if_objective_met(session, game)
    await session.commit()
    await session.refresh(game)
    return MoveResult(game=game, is_mistake=is_mistake)
