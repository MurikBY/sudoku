from typing import Any

from app.models.game import Game
from app.services.games.undo import MAX_UNDO_ENTRIES, push_undo_entry


def _game(notes: dict[str, list[int]], undo_stack: list[dict[str, Any]]) -> Game:
    return Game(notes=notes, undo_stack=undo_stack)


def test_entry_keeps_only_the_marks_the_action_changed() -> None:
    before = {"1": [3, 5], "2": [3], "40": [7]}
    game = _game({"1": [5], "40": [7]}, [])

    push_undo_entry(game, cell_index=0, previous_value=0, notes_before_action=before)

    assert game.undo_stack == [
        {"index": 0, "previous_value": 0, "notes_before": {"1": [3, 5], "2": [3]}},
    ]


def test_entry_records_a_cell_that_had_no_marks_as_empty() -> None:
    game = _game({"7": [4]}, [])

    push_undo_entry(game, cell_index=7, previous_value=None, notes_before_action={})

    assert game.undo_stack[-1]["notes_before"] == {"7": []}


def test_stack_keeps_the_newest_entries_up_to_the_cap() -> None:
    game = _game({}, [])

    for cell_index in range(MAX_UNDO_ENTRIES + 5):
        push_undo_entry(
            game,
            cell_index=cell_index % 81,
            previous_value=None,
            notes_before_action={},
        )

    assert len(game.undo_stack) == MAX_UNDO_ENTRIES
    assert game.undo_stack[-1]["index"] == (MAX_UNDO_ENTRIES + 4) % 81
    assert game.undo_stack[0]["index"] == 5
