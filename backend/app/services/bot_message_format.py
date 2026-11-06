from __future__ import annotations

from datetime import UTC, datetime


def format_elapsed(total_seconds: int) -> str:
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes}:{seconds:02d}"


def format_game_when(started_at: datetime) -> str:
    aware = started_at if started_at.tzinfo is not None else started_at.replace(tzinfo=UTC)
    return aware.astimezone(UTC).strftime("%d %b %Y, %H:%M UTC")
