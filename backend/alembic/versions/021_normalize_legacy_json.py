"""normalize legacy assists and game events

Revision ID: 021
Revises: 020
Create Date: 2026-10-29

"""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import Connection

revision: str = "021"
down_revision: str | Sequence[str] | None = "020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_BATCH_SIZE = 200

_OLDER_ASSIST_FLAGS = (
    "pencil",
    "highlight_peers",
    "highlight_same_digit",
    "mistake_feedback",
    "dim_completed_digits",
    "unit_complete_animation",
)

_JSON_COLUMNS: dict[tuple[str, str], tuple[str, str, str]] = {
    ("games", "assists"): (
        "SELECT id, assists FROM games ORDER BY id LIMIT :limit",
        "SELECT id, assists FROM games WHERE id > :last_id ORDER BY id LIMIT :limit",
        "UPDATE games SET assists = CAST(:assists AS jsonb) WHERE id = :id",
    ),
    ("parties", "assists"): (
        "SELECT id, assists FROM parties ORDER BY id LIMIT :limit",
        "SELECT id, assists FROM parties WHERE id > :last_id ORDER BY id LIMIT :limit",
        "UPDATE parties SET assists = CAST(:assists AS jsonb) WHERE id = :id",
    ),
    ("users", "preferences"): (
        "SELECT id, preferences FROM users ORDER BY id LIMIT :limit",
        "SELECT id, preferences FROM users WHERE id > :last_id ORDER BY id LIMIT :limit",
        "UPDATE users SET preferences = CAST(:preferences AS jsonb) WHERE id = :id",
    ),
    ("games", "events"): (
        "SELECT id, events FROM games ORDER BY id LIMIT :limit",
        "SELECT id, events FROM games WHERE id > :last_id ORDER BY id LIMIT :limit",
        "UPDATE games SET events = CAST(:events AS jsonb) WHERE id = :id",
    ),
}


def _default_auto_clear_notes(assists: dict[str, Any]) -> bool:
    present_flags = [
        assists[key]
        for key in _OLDER_ASSIST_FLAGS
        if key in assists and isinstance(assists[key], bool)
    ]
    # Every older flag off means the player cleared the set, so auto-clear stays off.
    every_assist_off = bool(present_flags) and not any(present_flags)
    return not every_assist_off


def normalize_assists(assists: Any) -> dict[str, Any]:
    if not isinstance(assists, dict):
        raise ValueError("assists must be an object")
    result = dict(assists)
    if "auto_clear_notes" not in result:
        result["auto_clear_notes"] = _default_auto_clear_notes(result)
    if "sticky_digit" not in result:
        result["sticky_digit"] = False
    return result


def normalize_user_preferences(preferences: Any) -> Any:
    if not isinstance(preferences, dict):
        raise ValueError("user preferences must be an object")
    if not preferences:
        # No saved preferences. The read path uses DEFAULT_ASSISTS, where sticky_digit is on.
        return preferences
    updated = dict(preferences)
    changed = False
    for key in ("assists", "custom_assists"):
        if key not in updated:
            continue
        assists = updated[key]
        if not isinstance(assists, dict):
            raise ValueError(f"preferences.{key} must be an object")
        normalized = normalize_assists(assists)
        if normalized != assists:
            updated[key] = normalized
            changed = True
    if not changed:
        return preferences
    return updated


def _peer_indices(cell: int) -> frozenset[int]:
    if cell < 0 or cell > 80:
        raise ValueError(f"cell index out of bounds: {cell}")
    row, col = divmod(cell, 9)
    peers = set(range(row * 9, row * 9 + 9))
    peers.update(range(col, 81, 9))
    box_row = (row // 3) * 3
    box_col = (col // 3) * 3
    for row_offset in range(3):
        for col_offset in range(3):
            peers.add((box_row + row_offset) * 9 + box_col + col_offset)
    peers.discard(cell)
    return frozenset(peers)


def normalize_game_events(events: Any) -> list[dict[str, Any]]:
    if not isinstance(events, list):
        raise ValueError("game events must be a list")
    normalized: list[dict[str, Any]] = []
    index = 0
    while index < len(events):
        event = dict(events[index])
        kind = event.get("kind")
        if (
            kind in {"set", "hint"}
            and not event.get("peer_notes")
            and isinstance(event.get("cell"), int)
            and isinstance(event.get("value"), int)
        ):
            move_cell = event["cell"]
            move_value = event["value"]
            peers = _peer_indices(move_cell)
            peer_notes: dict[str, list[int]] = {}
            cursor = index + 1
            while cursor < len(events):
                next_event = events[cursor]
                if next_event.get("kind") != "notes":
                    break
                peer_cell = next_event.get("cell")
                raw_notes = next_event.get("notes")
                if not isinstance(peer_cell, int) or peer_cell not in peers:
                    break
                if not isinstance(raw_notes, list):
                    break
                remaining = sorted(
                    {
                        int(digit)
                        for digit in raw_notes
                        if isinstance(digit, int | str)
                        and str(digit).isdigit()
                        and 1 <= int(digit) <= 9
                    },
                )
                if move_value in remaining:
                    break
                peer_notes[str(peer_cell)] = remaining
                cursor += 1
            if peer_notes:
                event["peer_notes"] = peer_notes
                normalized.append(event)
                index = cursor
                continue
        normalized.append(event)
        index += 1
    return normalized


def _rewrite_json_column(
    connection: Connection,
    table: str,
    column: str,
    normalize: Callable[[Any], Any],
) -> None:
    statements = _JSON_COLUMNS.get((table, column))
    if statements is None:
        raise ValueError(f"unexpected json column: {table}.{column}")
    select_first, select_next, update_sql = statements
    last_id = None
    while True:
        if last_id is None:
            rows = (
                connection.execute(sa.text(select_first), {"limit": _BATCH_SIZE}).mappings().all()
            )
        else:
            rows = (
                connection.execute(
                    sa.text(select_next),
                    {"limit": _BATCH_SIZE, "last_id": last_id},
                )
                .mappings()
                .all()
            )
        if not rows:
            return
        for row in rows:
            current = row[column]
            if isinstance(current, str):
                current = json.loads(current)
            normalized = normalize(current)
            if normalized != current:
                connection.execute(
                    sa.text(update_sql),
                    {column: json.dumps(normalized), "id": row["id"]},
                )
        last_id = rows[-1]["id"]


def upgrade() -> None:
    connection = op.get_bind()
    _rewrite_json_column(connection, "games", "assists", normalize_assists)
    _rewrite_json_column(connection, "parties", "assists", normalize_assists)
    _rewrite_json_column(connection, "users", "preferences", normalize_user_preferences)
    _rewrite_json_column(connection, "games", "events", normalize_game_events)


def downgrade() -> None:
    # Filled flags and merged peer notes cannot be restored to the legacy shape.
    pass
