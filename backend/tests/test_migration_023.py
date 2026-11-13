import importlib.util
from pathlib import Path
from types import ModuleType

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.services.games.board_notes import with_cell_notes


def _load_migration() -> ModuleType:
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "023_undo_entries_keep_changed_notes.py"
    )
    spec = importlib.util.spec_from_file_location("migration_023", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load migration: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_MIGRATION = _load_migration()

_notes_maps = st.dictionaries(
    keys=st.sampled_from([str(cell) for cell in range(6)]),
    values=st.lists(st.integers(min_value=1, max_value=9), min_size=1, max_size=4, unique=True),
    max_size=4,
)


def _old_stack(maps: list[dict[str, list[int]]]) -> list[dict]:
    return [
        {"index": position % 81, "previous_value": None, "previous_notes": notes}
        for position, notes in enumerate(maps)
    ]


def _sorted_marks(notes: dict[str, list[int]]) -> dict[str, list[int]]:
    return {cell_key: sorted(digits) for cell_key, digits in notes.items()}


@given(maps=st.lists(_notes_maps, min_size=1, max_size=12), live=_notes_maps)
def test_converted_stack_undoes_to_the_same_marks(maps, live) -> None:
    converted = _MIGRATION.keep_changed_notes(_old_stack(maps), live)

    current = _sorted_marks(live)
    for entry, expected in zip(reversed(converted), reversed(maps), strict=True):
        current = with_cell_notes(current, entry["notes_before"])
        assert current == _sorted_marks(expected)


@given(maps=st.lists(_notes_maps, min_size=1, max_size=12), live=_notes_maps)
def test_downgrade_rebuilds_the_whole_maps(maps, live) -> None:
    converted = _MIGRATION.keep_changed_notes(_old_stack(maps), live)

    restored = _MIGRATION.restore_whole_notes(converted, live)

    assert [entry["previous_notes"] for entry in restored] == [_sorted_marks(m) for m in maps]


def test_conversion_keeps_index_value_and_only_changed_cells() -> None:
    stack = [
        {"index": 0, "previous_value": 0, "previous_notes": {"1": [3, 5], "2": [3], "40": [7]}},
    ]
    live = {"1": [5], "40": [7]}

    assert _MIGRATION.keep_changed_notes(stack, live) == [
        {"index": 0, "previous_value": 0, "notes_before": {"1": [3, 5], "2": [3]}},
    ]


def test_conversion_keeps_the_newest_entries_up_to_the_cap() -> None:
    cap = _MIGRATION._MAX_UNDO_ENTRIES
    stack = _old_stack([{} for _ in range(cap + 3)])

    converted = _MIGRATION.keep_changed_notes(stack, {})

    assert len(converted) == cap
    assert converted[0]["index"] == 3


def test_upgrade_rejects_an_entry_that_is_already_converted() -> None:
    with pytest.raises(ValueError, match="undo entry must have exactly"):
        _MIGRATION.keep_changed_notes(
            [{"index": 0, "previous_value": None, "notes_before": {}}],
            {},
        )
