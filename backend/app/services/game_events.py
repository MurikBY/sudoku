from __future__ import annotations

from typing import Any, assert_never

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.game import Game
from app.schemas.game import GameEventKind
from app.services.games.stored_state import (
    ClearEvent,
    HintEvent,
    NotesEvent,
    SetEvent,
    StoredEvent,
    dump_game_event,
    read_events,
)
from app.services.unique_codes import SHARE_CODE_LENGTH, allocate_unique_code


async def allocate_share_code(session: AsyncSession) -> str:
    return await allocate_unique_code(session, Game.share_code, SHARE_CODE_LENGTH)


def append_game_event(
    game: Game,
    kind: GameEventKind,
    *,
    cell: int | None = None,
    value: int | None = None,
    notes: list[int] | None = None,
    peer_notes: dict[str, list[int]] | None = None,
) -> None:
    event = dump_game_event(
        kind,
        cell=cell,
        value=value,
        notes=notes,
        peer_notes=peer_notes,
    )
    events = list(game.events)
    events.append(event)
    game.events = events
    flag_modified(game, "events")


def _apply_note_digits(notes: dict[str, list[int]], cell_key: str, digits: list[int]) -> None:
    remaining = sorted(set(digits))
    if remaining:
        notes[cell_key] = remaining
    else:
        notes.pop(cell_key, None)


def _place_digit(
    grid_chars: list[str],
    notes: dict[str, list[int]],
    event: SetEvent | HintEvent,
    *,
    apply_peer_notes: bool,
) -> None:
    grid_chars[event.cell] = str(event.value)
    notes.pop(str(event.cell), None)
    if not apply_peer_notes or event.peer_notes is None:
        return
    for peer_key, digits in event.peer_notes.items():
        _apply_note_digits(notes, peer_key, digits)


def _clear_cell(grid_chars: list[str], notes: dict[str, list[int]], event: ClearEvent) -> None:
    grid_chars[event.cell] = "0"
    notes.pop(str(event.cell), None)


def _replay_notes_event(
    grid_chars: list[str],
    notes: dict[str, list[int]],
    event: NotesEvent,
) -> None:
    if grid_chars[event.cell] != "0":
        return
    _apply_note_digits(notes, str(event.cell), event.notes)


def _replay_event(
    grid_chars: list[str],
    notes: dict[str, list[int]],
    event: StoredEvent,
    *,
    apply_peer_notes: bool,
) -> None:
    if isinstance(event, SetEvent):
        _place_digit(grid_chars, notes, event, apply_peer_notes=apply_peer_notes)
        return
    if isinstance(event, HintEvent):
        _place_digit(grid_chars, notes, event, apply_peer_notes=apply_peer_notes)
        return
    if isinstance(event, ClearEvent):
        _clear_cell(grid_chars, notes, event)
        return
    if isinstance(event, NotesEvent):
        _replay_notes_event(grid_chars, notes, event)
        return
    assert_never(event)


def replay_events_to_state(
    puzzle: str,
    events: list[dict[str, Any]],
    event_count: int,
    *,
    suppress_last_peer_notes: bool = False,
) -> tuple[str, dict[str, list[int]]]:
    if event_count < 0 or event_count > len(events):
        raise ValueError("event_count out of range")
    try:
        parsed = read_events(events[:event_count])
    except ValidationError as error:
        raise ValueError("invalid stored event") from error
    grid_chars = list(puzzle)
    notes: dict[str, list[int]] = {}
    last_index = len(parsed) - 1
    for event_index, event in enumerate(parsed):
        _replay_event(
            grid_chars,
            notes,
            event,
            apply_peer_notes=not (suppress_last_peer_notes and event_index == last_index),
        )
    return "".join(grid_chars), notes
