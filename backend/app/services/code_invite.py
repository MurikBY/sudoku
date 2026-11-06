from __future__ import annotations

import html
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import GameStatus, PartyStatus
from app.models.game import Game
from app.models.party import Party
from app.schemas.preferences import GameAssistsPayload
from app.services.bot_message_format import format_elapsed, format_game_when
from app.services.unique_codes import CODE_ALPHABET, PARTY_CODE_LENGTH, SHARE_CODE_LENGTH
from app.services.user_display_name import ANONYMOUS_DISPLAY_NAME

ASSIST_LABELS: tuple[tuple[str, str], ...] = (
    ("pencil", "Pencil marks"),
    ("highlight_peers", "Highlight row / column / box"),
    ("highlight_same_digit", "Highlight same digit"),
    ("mistake_feedback", "Highlight mistakes"),
    ("dim_completed_digits", "Dim completed digits"),
    ("unit_complete_animation", "Flash completed r/c/b"),
    ("auto_clear_notes", "Auto-clear notes"),
    ("sticky_digit", "Long-press to lock digit"),
)


@dataclass(frozen=True, slots=True)
class LobbyInvite:
    code: str
    host_display_name: str
    player_count: int
    difficulty: str
    assists: GameAssistsPayload


@dataclass(frozen=True, slots=True)
class GameInvite:
    code: str
    display_name: str
    difficulty: str
    status: GameStatus
    started_at: datetime
    elapsed_seconds: int
    mistakes_count: int
    hints_count: int
    pencil_count: int


@dataclass(frozen=True, slots=True)
class InviteUnavailable:
    kind: Literal["lobby_started", "lobby_closed", "not_found"]
    code: str


InviteLookup = LobbyInvite | GameInvite | InviteUnavailable


def normalize_invite_code(raw: str) -> str | None:
    text = raw.strip().upper()
    if not text:
        return None
    if len(text) == PARTY_CODE_LENGTH and all(char in CODE_ALPHABET for char in text):
        return text
    if len(text) == SHARE_CODE_LENGTH and all(char in CODE_ALPHABET for char in text):
        return text
    return None


def format_status(status: GameStatus) -> str:
    if status == GameStatus.in_progress:
        return "In progress"
    if status == GameStatus.completed:
        return "Completed"
    return "Abandoned"


def _assist_sections(assists: GameAssistsPayload) -> tuple[list[str], list[str]]:
    enabled: list[str] = []
    disabled: list[str] = []
    payload = assists.model_dump()
    for key, label in ASSIST_LABELS:
        if payload[key]:
            enabled.append(label)
        else:
            disabled.append(label)
    return enabled, disabled


def _bullet_list(labels: list[str]) -> str:
    return "\n".join(f"• {label}" for label in labels)


def build_lobby_invite_message(invite: LobbyInvite) -> str:
    enabled, disabled = _assist_sections(invite.assists)
    lines = [
        f"<b>{html.escape(invite.host_display_name)}</b> invites you to join their Sudoku lobby.",
        "",
        f"Players in lobby: <b>{invite.player_count}</b>",
        f"Difficulty: <b>{invite.difficulty.capitalize()}</b>",
        f"Code: <code>{invite.code}</code>",
        "",
    ]
    if enabled:
        lines.append("<b>Settings on</b>")
        lines.append(_bullet_list(enabled))
        lines.append("")
    if disabled:
        lines.append("<b>Settings off</b>")
        lines.append(_bullet_list(disabled))
        lines.append("")
    lines.append("Tap below to open the lobby.")
    return "\n".join(lines).rstrip()


def build_game_invite_message(invite: GameInvite) -> str:
    return (
        f"<b>Game by {html.escape(invite.display_name)}</b>\n\n"
        f"{format_game_when(invite.started_at)}\n"
        f"Status: <b>{format_status(invite.status)}</b>\n"
        f"Difficulty: <b>{invite.difficulty.capitalize()}</b>\n"
        f"Time: <b>{format_elapsed(invite.elapsed_seconds)}</b>\n"
        f"Mistakes: <b>{invite.mistakes_count}</b> · "
        f"Hints: <b>{invite.hints_count}</b> · "
        f"Pencil: <b>{invite.pencil_count}</b>\n"
        f"Code: <code>{invite.code}</code>\n\n"
        "Tap below to open Game Review."
    )


def build_unavailable_message(result: InviteUnavailable) -> str:
    if result.kind == "lobby_started":
        return (
            f"Lobby <code>{result.code}</code> has already started "
            "and is no longer accepting players."
        )
    if result.kind == "lobby_closed":
        return f"Lobby <code>{result.code}</code> is closed."
    return f"No lobby or game found for code <code>{result.code}</code>."


def _format_handle(name: str | None) -> str:
    trimmed = (name or "").strip()
    if not trimmed or trimmed == ANONYMOUS_DISPLAY_NAME:
        return ANONYMOUS_DISPLAY_NAME
    return trimmed if trimmed.startswith("@") else f"@{trimmed}"


def _display_name_from_user(username: str | None) -> str:
    return _format_handle(username)


async def _resolve_lobby_invite(session: AsyncSession, code: str) -> InviteLookup:
    party_result = await session.execute(
        select(Party)
        .where(Party.code == code)
        .options(
            selectinload(Party.members),
            selectinload(Party.host),
        ),
    )
    party = party_result.scalar_one_or_none()
    if party is None:
        return InviteUnavailable(kind="not_found", code=code)
    if party.status == PartyStatus.started:
        return InviteUnavailable(kind="lobby_started", code=code)
    if party.status == PartyStatus.cancelled:
        return InviteUnavailable(kind="lobby_closed", code=code)
    host_member = next(
        (member for member in party.members if member.user_id == party.host_user_id),
        None,
    )
    host_name = _format_handle(
        host_member.display_name if host_member is not None else party.host.username,
    )
    return LobbyInvite(
        code=party.code,
        host_display_name=host_name,
        player_count=len(party.members),
        difficulty=party.difficulty.value,
        assists=GameAssistsPayload.model_validate(party.assists),
    )


async def _resolve_game_invite(session: AsyncSession, code: str) -> InviteLookup:
    game_result = await session.execute(
        select(Game).where(Game.share_code == code).options(selectinload(Game.user)),
    )
    game = game_result.scalar_one_or_none()
    if game is None or game.is_analysis or game.is_lesson:
        return InviteUnavailable(kind="not_found", code=code)
    return GameInvite(
        code=game.share_code,
        display_name=_display_name_from_user(game.user.username),
        difficulty=game.difficulty.value,
        status=game.status,
        started_at=game.started_at,
        elapsed_seconds=game.elapsed_seconds,
        mistakes_count=game.mistakes_count,
        hints_count=game.hints_count,
        pencil_count=game.pencil_count,
    )


async def resolve_invite_code(session: AsyncSession, raw: str) -> InviteLookup:
    code = normalize_invite_code(raw)
    if code is None:
        return InviteUnavailable(kind="not_found", code=raw.strip().upper() or "?")
    if len(code) == PARTY_CODE_LENGTH:
        return await _resolve_lobby_invite(session, code)
    return await _resolve_game_invite(session, code)
