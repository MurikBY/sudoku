"""keep only the changed pencil marks in each undo entry

Revision ID: 023
Revises: 022
Create Date: 2026-11-13

"""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import Connection

revision: str = "023"
down_revision: str | Sequence[str] | None = "022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_BATCH_SIZE = 200
# Frozen copy of MAX_UNDO_ENTRIES at this revision.
_MAX_UNDO_ENTRIES = 200

_SELECT_FIRST = (
    "SELECT id, notes, undo_stack FROM games "
    "WHERE undo_stack <> '[]'::jsonb ORDER BY id LIMIT :limit"
)
_SELECT_NEXT = (
    "SELECT id, notes, undo_stack FROM games "
    "WHERE undo_stack <> '[]'::jsonb AND id > :last_id ORDER BY id LIMIT :limit"
)
_UPDATE = "UPDATE games SET undo_stack = CAST(:undo_stack AS jsonb) WHERE id = :id"


def _marks(notes: Any) -> dict[str, list[int]]:
    if not isinstance(notes, dict):
        raise ValueError("notes must be an object")
    return {cell_key: sorted(set(digits)) for cell_key, digits in notes.items() if digits}


def _require_keys(entry: Any, keys: set[str]) -> dict[str, Any]:
    if not isinstance(entry, dict) or set(entry) != keys:
        raise ValueError(f"undo entry must have exactly {sorted(keys)}: {entry!r}")
    return entry


def _changed_cell_keys(before: dict[str, list[int]], after: dict[str, list[int]]) -> list[str]:
    cell_keys = set(before) | set(after)
    return sorted(
        (cell_key for cell_key in cell_keys if before.get(cell_key, []) != after.get(cell_key, [])),
        key=int,
    )


def keep_changed_notes(undo_stack: Any, notes: Any) -> list[dict[str, Any]]:
    # Entry i held the whole map before action i; the map before action i + 1, or the
    # live notes after the last action, is the map after it. Their difference is what
    # undo restores, so the converted stack undoes to the same boards.
    if not isinstance(undo_stack, list):
        raise ValueError("undo_stack must be a list")
    entries = [
        _require_keys(entry, {"index", "previous_value", "previous_notes"}) for entry in undo_stack
    ]
    maps = [_marks(entry["previous_notes"]) for entry in entries] + [_marks(notes)]
    converted = [
        {
            "index": entry["index"],
            "previous_value": entry["previous_value"],
            "notes_before": {
                cell_key: maps[position].get(cell_key, [])
                for cell_key in _changed_cell_keys(maps[position], maps[position + 1])
            },
        }
        for position, entry in enumerate(entries)
    ]
    return converted[-_MAX_UNDO_ENTRIES:]


def restore_whole_notes(undo_stack: Any, notes: Any) -> list[dict[str, Any]]:
    if not isinstance(undo_stack, list):
        raise ValueError("undo_stack must be a list")
    entries = [
        _require_keys(entry, {"index", "previous_value", "notes_before"}) for entry in undo_stack
    ]
    after = _marks(notes)
    restored: list[dict[str, Any]] = []
    for entry in reversed(entries):
        before = dict(after)
        for cell_key, digits in entry["notes_before"].items():
            if digits:
                before[cell_key] = sorted(set(digits))
            else:
                before.pop(cell_key, None)
        restored.append(
            {
                "index": entry["index"],
                "previous_value": entry["previous_value"],
                "previous_notes": before,
            },
        )
        after = before
    return list(reversed(restored))


def _rewrite_undo_stacks(
    connection: Connection,
    convert: Callable[[Any, Any], list[dict[str, Any]]],
) -> None:
    last_id = None
    while True:
        if last_id is None:
            statement, params = _SELECT_FIRST, {"limit": _BATCH_SIZE}
        else:
            statement, params = _SELECT_NEXT, {"limit": _BATCH_SIZE, "last_id": last_id}
        rows = connection.execute(sa.text(statement), params).mappings().all()
        if not rows:
            return
        for row in rows:
            undo_stack = row["undo_stack"]
            notes = row["notes"]
            if isinstance(undo_stack, str):
                undo_stack = json.loads(undo_stack)
            if isinstance(notes, str):
                notes = json.loads(notes)
            connection.execute(
                sa.text(_UPDATE),
                {"undo_stack": json.dumps(convert(undo_stack, notes)), "id": row["id"]},
            )
        last_id = rows[-1]["id"]


def upgrade() -> None:
    _rewrite_undo_stacks(op.get_bind(), keep_changed_notes)


def downgrade() -> None:
    # Entries dropped by the cap on upgrade are not restored.
    _rewrite_undo_stacks(op.get_bind(), restore_whole_notes)
