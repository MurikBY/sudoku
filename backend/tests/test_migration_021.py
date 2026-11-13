import copy
import importlib.util
from pathlib import Path

import pytest

from app.services.sudoku.grid import peer_indices

_OLDER_ASSIST_FLAGS = (
    "pencil",
    "highlight_peers",
    "highlight_same_digit",
    "mistake_feedback",
    "dim_completed_digits",
    "unit_complete_animation",
)


def _load_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "021_normalize_legacy_json.py"
    )
    spec = importlib.util.spec_from_file_location("migration_021", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load migration: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_MIGRATION = _load_migration()


def _assert_normalizes(function, sample, expected) -> None:
    original = copy.deepcopy(sample)
    once = function(sample)
    assert sample == original
    assert once == expected
    assert function(once) == once


def test_each_older_flag_off_by_itself_turns_auto_clear_off():
    for flag in _OLDER_ASSIST_FLAGS:
        normalized = _MIGRATION.normalize_assists({flag: False})
        assert normalized["auto_clear_notes"] is False
        assert normalized["sticky_digit"] is False
        assert _MIGRATION.normalize_assists(normalized) == normalized


@pytest.mark.parametrize(
    ("assists", "auto_clear_notes", "sticky_digit"),
    [
        (dict.fromkeys(_OLDER_ASSIST_FLAGS, False), False, False),
        (dict.fromkeys(_OLDER_ASSIST_FLAGS, True), True, False),
        ({"pencil": True, "highlight_peers": False}, True, False),
        ({}, True, False),
        ({"pencil": "off"}, True, False),
        ({"pencil": True, "auto_clear_notes": False}, False, False),
        ({"sticky_digit": True}, True, True),
        (
            {
                "pencil": True,
                "auto_clear_notes": True,
                "sticky_digit": True,
                "future": 1,
            },
            True,
            True,
        ),
    ],
)
def test_normalize_assists(assists: dict, auto_clear_notes: bool, sticky_digit: bool):
    original = copy.deepcopy(assists)
    normalized = _MIGRATION.normalize_assists(assists)
    assert assists == original
    assert normalized["auto_clear_notes"] is auto_clear_notes
    assert normalized["sticky_digit"] is sticky_digit
    for key, value in original.items():
        assert normalized[key] == value
    assert _MIGRATION.normalize_assists(normalized) == normalized


def test_normalize_assists_rejects_a_non_object():
    with pytest.raises(ValueError, match="assists must be an object"):
        _MIGRATION.normalize_assists([])


def test_normalize_user_preferences_leaves_objects_without_assist_payloads():
    _assert_normalizes(_MIGRATION.normalize_user_preferences, {}, {})
    _assert_normalizes(
        _MIGRATION.normalize_user_preferences,
        {"difficulty": "medium"},
        {"difficulty": "medium"},
    )


def test_normalize_user_preferences_fills_present_assist_objects_only():
    all_off = dict.fromkeys(_OLDER_ASSIST_FLAGS, False)
    complete = {
        **dict.fromkeys(_OLDER_ASSIST_FLAGS, True),
        "auto_clear_notes": True,
        "sticky_digit": True,
    }
    sample = {"difficulty": "hard", "assists": all_off, "custom_assists": complete}
    expected = {
        "difficulty": "hard",
        "assists": {**all_off, "auto_clear_notes": False, "sticky_digit": False},
        "custom_assists": complete,
    }
    _assert_normalizes(_MIGRATION.normalize_user_preferences, sample, expected)


def test_normalize_user_preferences_rejects_a_non_object():
    with pytest.raises(ValueError, match="user preferences must be an object"):
        _MIGRATION.normalize_user_preferences([])


def test_normalize_user_preferences_rejects_a_non_object_assist_payload():
    with pytest.raises(ValueError, match=r"preferences\.assists must be an object"):
        _MIGRATION.normalize_user_preferences({"assists": []})


def test_copied_peer_indices_match_the_engine():
    for cell in range(81):
        assert _MIGRATION._peer_indices(cell) == peer_indices(cell)


def test_normalize_game_events_merges_legacy_peer_notes():
    events = [
        {"kind": "notes", "cell": 1, "notes": [5, 8]},
        {"kind": "notes", "cell": 2, "notes": [5]},
        {"kind": "set", "cell": 0, "value": 5},
        {"kind": "notes", "cell": 1, "notes": [8]},
        {"kind": "notes", "cell": 2, "notes": []},
        {"kind": "notes", "cell": 80, "notes": [1, 2]},
    ]
    expected = [
        {"kind": "notes", "cell": 1, "notes": [5, 8]},
        {"kind": "notes", "cell": 2, "notes": [5]},
        {
            "kind": "set",
            "cell": 0,
            "value": 5,
            "peer_notes": {"1": [8], "2": []},
        },
        {"kind": "notes", "cell": 80, "notes": [1, 2]},
    ]
    _assert_normalizes(_MIGRATION.normalize_game_events, events, expected)


def test_normalize_game_events_keeps_manual_notes_that_still_contain_the_digit():
    events = [
        {"kind": "set", "cell": 0, "value": 5},
        {"kind": "notes", "cell": 1, "notes": [5, 8]},
    ]
    _assert_normalizes(_MIGRATION.normalize_game_events, events, events)


def test_normalize_game_events_keeps_notes_after_peer_notes_already_stored():
    events = [
        {"kind": "set", "cell": 0, "value": 5, "peer_notes": {"1": [8]}},
        {"kind": "notes", "cell": 2, "notes": [1]},
    ]
    _assert_normalizes(_MIGRATION.normalize_game_events, events, events)


def test_normalize_game_events_merges_a_legacy_hint_and_string_digits():
    events = [
        {"kind": "hint", "cell": 0, "value": 5},
        {"kind": "notes", "cell": 1, "notes": ["8"]},
    ]
    expected = [
        {
            "kind": "hint",
            "cell": 0,
            "value": 5,
            "peer_notes": {"1": [8]},
        },
    ]
    _assert_normalizes(_MIGRATION.normalize_game_events, events, expected)


def test_normalize_game_events_rejects_a_non_list():
    with pytest.raises(ValueError, match="game events must be a list"):
        _MIGRATION.normalize_game_events({})
