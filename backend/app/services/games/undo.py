import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.game import Game
from app.services.game_events import append_game_event
from app.services.games.board_notes import (
    clear_cell_notes,
    copy_notes_map,
    replace_notes_map,
    validate_notes_target,
)
from app.services.games.errors import InvalidMove, InvalidNotes, UndoUnavailable
from app.services.games.lifecycle import credit_play_time
from app.services.games.queries import get_game_in_progress
from app.services.games.stored_state import dump_undo_entry, read_undo_entry
from app.services.lesson_progress_service import (
    drop_progress_cleared_by_undo,
    lesson_objective_is_met,
    record_if_objective_met,
)
from app.services.sudoku.grid import EMPTY_CELL, parse_grid
from app.services.sudoku.validator import validate_move


@dataclass(frozen=True)
class UndoResult:
    game: Game
    flashed_cell_indices: list[int]
    undone_cell_index: int


def push_undo_entry(
    game: Game,
    *,
    cell_index: int,
    previous_value: int | None,
) -> None:
    stack = list(game.undo_stack)
    stack.append(
        dump_undo_entry(
            index=cell_index,
            previous_value=previous_value,
            previous_notes=copy_notes_map(game.notes),
        ),
    )
    game.undo_stack = stack
    flag_modified(game, "undo_stack")


def _cells_changed_by_undo(
    game: Game,
    cell_index: int,
    previous_value: int | None,
    previous_notes: dict[str, list[int]],
) -> list[int]:
    affected: set[int] = set()
    if previous_value is not None:
        current_value = parse_grid(game.current_grid)[cell_index]
        if current_value != previous_value:
            affected.add(cell_index)
    for notes_cell_key in set(game.notes) | set(previous_notes):
        if game.notes.get(notes_cell_key, []) != previous_notes.get(notes_cell_key, []):
            affected.add(int(notes_cell_key))
    return sorted(affected)


async def undo_last_move(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    elapsed_seconds: int | None,
) -> UndoResult:
    game = await get_game_in_progress(session, user_id, game_id, for_update=True)
    stack = list(game.undo_stack)
    if not stack:
        raise UndoUnavailable("nothing to undo")
    objective_was_met = lesson_objective_is_met(game)
    cell_index, previous_value, previous_notes = read_undo_entry(stack[-1])
    flashed_cell_indices = _cells_changed_by_undo(
        game,
        cell_index,
        previous_value,
        previous_notes,
    )
    stack.pop()

    if previous_value is not None:
        current_value = parse_grid(game.current_grid)[cell_index]
        if current_value != previous_value:
            try:
                validate_move(game.puzzle, game.current_grid, cell_index, previous_value)
            except ValueError as error:
                raise InvalidMove(str(error)) from error
            grid_chars = list(game.current_grid)
            grid_chars[cell_index] = str(previous_value)
            game.current_grid = "".join(grid_chars)
            if previous_value == EMPTY_CELL:
                append_game_event(game, "clear", cell=cell_index)
            else:
                clear_cell_notes(game, cell_index)
                append_game_event(game, "set", cell=cell_index, value=previous_value)

    try:
        for notes_cell_key in previous_notes:
            validate_notes_target(game.puzzle, game.current_grid, int(notes_cell_key))
    except ValueError as error:
        raise InvalidNotes(str(error)) from error
    replace_notes_map(game, previous_notes)

    game.undo_stack = stack
    flag_modified(game, "undo_stack")
    if elapsed_seconds is not None:
        credit_play_time(game, elapsed_seconds)

    await record_if_objective_met(session, game)
    await drop_progress_cleared_by_undo(session, game, objective_was_met)

    await session.commit()
    return UndoResult(
        game=game,
        flashed_cell_indices=flashed_cell_indices,
        undone_cell_index=cell_index,
    )
