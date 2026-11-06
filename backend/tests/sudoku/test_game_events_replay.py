import pytest

from app.services.game_events import replay_events_to_state


def test_replay_events_applies_set_notes_and_clear():
    puzzle = "0" * 81
    events = [
        {"kind": "set", "cell": 0, "value": 5},
        {"kind": "notes", "cell": 1, "notes": [2, 8]},
        {"kind": "clear", "cell": 0},
    ]
    grid, notes = replay_events_to_state(puzzle, events, 2)
    assert grid[0] == "5"
    assert notes["1"] == [2, 8]
    grid, notes = replay_events_to_state(puzzle, events, 3)
    assert grid[0] == "0"
    assert notes["1"] == [2, 8]


def test_replay_events_hint_clears_notes_on_cell():
    puzzle = "0" * 81
    events = [
        {"kind": "notes", "cell": 4, "notes": [1, 3]},
        {"kind": "hint", "cell": 4, "value": 9},
    ]
    grid, notes = replay_events_to_state(puzzle, events, 2)
    assert grid[4] == "9"
    assert "4" not in notes


def test_replay_events_applies_peer_notes_on_set():
    puzzle = "0" * 81
    events = [
        {"kind": "notes", "cell": 1, "notes": [5, 8]},
        {"kind": "notes", "cell": 2, "notes": [5]},
        {
            "kind": "set",
            "cell": 0,
            "value": 5,
            "peer_notes": {"1": [8], "2": []},
        },
    ]
    grid, notes = replay_events_to_state(puzzle, events, 3)
    assert grid[0] == "5"
    assert notes["1"] == [8]
    assert "2" not in notes


def test_replay_can_suppress_last_peer_notes():
    puzzle = "0" * 81
    events = [
        {"kind": "notes", "cell": 1, "notes": [5, 8]},
        {
            "kind": "set",
            "cell": 0,
            "value": 5,
            "peer_notes": {"1": [8]},
        },
    ]
    grid, notes = replay_events_to_state(
        puzzle,
        events,
        2,
        suppress_last_peer_notes=True,
    )
    assert grid[0] == "5"
    assert notes["1"] == [5, 8]


def test_replay_rejects_a_numeric_string_peer_digit():
    events = [{"kind": "set", "cell": 0, "value": 5, "peer_notes": {"1": ["8"]}}]
    with pytest.raises(ValueError, match="invalid stored event"):
        replay_events_to_state("0" * 81, events, 1)


def test_replay_sorts_and_uniques_applied_note_digits():
    events = [{"kind": "notes", "cell": 1, "notes": [8, 2, 2]}]
    _grid, notes = replay_events_to_state("0" * 81, events, 1)
    assert notes["1"] == [2, 8]


def test_replay_ignores_notes_on_a_filled_cell():
    puzzle = "5" + "0" * 80
    events = [{"kind": "notes", "cell": 0, "notes": [1, 2]}]
    grid, notes = replay_events_to_state(puzzle, events, 1)
    assert grid[0] == "5"
    assert notes == {}


def test_replay_rejects_invalid_notes_on_a_filled_cell():
    puzzle = "5" + "0" * 80
    events = [{"kind": "notes", "cell": 0, "notes": [10]}]
    with pytest.raises(ValueError, match="invalid stored event"):
        replay_events_to_state(puzzle, events, 1)


def test_replay_ignores_an_invalid_event_after_the_prefix():
    events = [
        {"kind": "set", "cell": 0, "value": 5},
        {"kind": "nope"},
    ]
    grid, notes = replay_events_to_state("0" * 81, events, 1)
    assert grid[0] == "5"
    assert notes == {}


@pytest.mark.parametrize(
    "peer_notes",
    [
        [1],
        {"1": [0]},
        {"1": [True]},
        {"nope": [1]},
        {"99": [1]},
        {"1": "8"},
    ],
)
def test_replay_rejects_invalid_peer_notes(peer_notes: object) -> None:
    events = [{"kind": "set", "cell": 0, "value": 5, "peer_notes": peer_notes}]
    with pytest.raises(ValueError, match="invalid stored event"):
        replay_events_to_state("0" * 81, events, 1)


def test_replay_rejects_a_note_digit_outside_1_to_9():
    events = [{"kind": "notes", "cell": 1, "notes": [10]}]
    with pytest.raises(ValueError, match="invalid stored event"):
        replay_events_to_state("0" * 81, events, 1)
