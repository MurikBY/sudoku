import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.game import Game
from app.services.game_events import append_game_event
from app.services.games.board_notes import (
    copy_notes_map,
    normalize_note_digits,
    validate_notes_target,
)
from app.services.games.errors import InvalidNotes
from app.services.games.lifecycle import credit_play_time
from app.services.games.queries import get_game_in_progress
from app.services.games.stored_state import dump_notes
from app.services.games.undo import push_undo_entry
from app.services.lesson_progress_service import record_if_objective_met


async def apply_notes(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    cell_index: int,
    digits: list[int],
    elapsed_seconds: int | None,
) -> Game:
    game = await get_game_in_progress(session, user_id, game_id, for_update=True)
    cell_key = str(cell_index)
    try:
        validate_notes_target(game.puzzle, game.current_grid, cell_index)
        normalized_digits = normalize_note_digits(digits)
        current_cell_digits = normalize_note_digits(list(game.notes.get(cell_key, [])))
    except ValueError as error:
        raise InvalidNotes(str(error)) from error

    if current_cell_digits == normalized_digits:
        if elapsed_seconds is not None:
            credit_play_time(game, elapsed_seconds)
        await session.commit()
        return game

    notes_before_action = copy_notes_map(game.notes)
    notes = dict(game.notes)
    if normalized_digits:
        notes[cell_key] = normalized_digits
    else:
        notes.pop(cell_key, None)
    game.notes = dump_notes(notes)
    game.pencil_count += 1
    flag_modified(game, "notes")
    append_game_event(game, "notes", cell=cell_index, notes=normalized_digits)
    push_undo_entry(
        game,
        cell_index=cell_index,
        previous_value=None,
        notes_before_action=notes_before_action,
    )
    if elapsed_seconds is not None:
        credit_play_time(game, elapsed_seconds)

    await record_if_objective_met(session, game)
    await session.commit()
    return game
