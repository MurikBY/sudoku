import pytest
from pydantic import ValidationError

from app.services.games.stored_state import (
    dump_game_event,
    dump_stored_event,
    dump_undo_entry,
    read_events,
    read_notes,
    read_undo_entry,
)


def test_each_event_kind_round_trips() -> None:
    events = [
        {"kind": "set", "cell": 0, "value": 5, "peer_notes": {"1": [8], "2": []}},
        {"kind": "hint", "cell": 4, "value": 9},
        {"kind": "clear", "cell": 3},
        {"kind": "notes", "cell": 1, "notes": [8, 2]},
    ]
    assert [dump_stored_event(event) for event in read_events(events)] == events


def test_writer_omits_empty_peer_notes_and_keeps_a_cleared_cell() -> None:
    assert dump_game_event("set", cell=0, value=5, peer_notes={}) == {
        "kind": "set",
        "cell": 0,
        "value": 5,
    }
    assert dump_game_event("set", cell=0, value=5, peer_notes={"2": []}) == {
        "kind": "set",
        "cell": 0,
        "value": 5,
        "peer_notes": {"2": []},
    }
    assert dump_game_event("clear", cell=3) == {"kind": "clear", "cell": 3}
    assert dump_game_event("hint", cell=4, value=9) == {
        "kind": "hint",
        "cell": 4,
        "value": 9,
    }
    assert dump_game_event("notes", cell=1, notes=[]) == {
        "kind": "notes",
        "cell": 1,
        "notes": [],
    }


def test_unsorted_notes_read_back_sorted_without_empty_cells() -> None:
    assert read_notes({"3": [8, 1, 1], "4": [], "10": [2]}) == {"3": [1, 8], "10": [2]}


def test_undo_entry_keeps_zero_and_null_and_sorts_notes() -> None:
    assert dump_undo_entry(index=4, previous_value=0, notes_before={"1": [2]}) == {
        "index": 4,
        "previous_value": 0,
        "notes_before": {"1": [2]},
    }
    assert dump_undo_entry(index=4, previous_value=None, notes_before={}) == {
        "index": 4,
        "previous_value": None,
        "notes_before": {},
    }
    # An empty list stays: that cell had no marks before the action.
    assert read_undo_entry(
        {"index": 4, "previous_value": 0, "notes_before": {"8": [3, 1, 1], "9": []}},
    ) == (4, 0, {"8": [1, 3], "9": []})


def test_undo_entry_with_the_whole_notes_map_is_rejected() -> None:
    with pytest.raises(RuntimeError, match="invalid undo entry"):
        read_undo_entry({"index": 4, "previous_value": 0, "previous_notes": {"8": [1]}})


@pytest.mark.parametrize(
    "raw",
    [
        [{"kind": "nope", "cell": 0}],
        [{"kind": "set", "cell": 81, "value": 1}],
        [{"kind": "set", "cell": 0, "value": 0}],
        [{"kind": "notes", "cell": 1, "notes": [True]}],
        [{"kind": "set", "cell": 0, "value": 5, "peer_notes": {"1": ["8"]}}],
        [{"kind": "set", "cell": 0, "value": 5, "extra": 1}],
    ],
)
def test_invalid_events_are_rejected(raw: list[object]) -> None:
    with pytest.raises(ValidationError):
        read_events(raw)


@pytest.mark.parametrize(
    "raw",
    [
        {"81": [1]},
        {"08": [1]},
        {"0": [True]},
        {"0": ["8"]},
    ],
)
def test_invalid_notes_are_rejected(raw: dict[str, list[object]]) -> None:
    with pytest.raises(ValidationError):
        read_notes(raw)


def test_invalid_undo_entry_raises_runtime_error() -> None:
    with pytest.raises(RuntimeError, match="invalid undo entry"):
        read_undo_entry({"index": 0, "previous_value": True, "previous_notes": {}})
