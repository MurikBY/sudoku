from __future__ import annotations

import html
import logging
from datetime import datetime

from aiogram import Bot
from aiogram.enums import ParseMode
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.game import Game
from app.models.party import Party
from app.services.bot_message_format import format_elapsed, format_game_when

logger = logging.getLogger(__name__)


def build_completion_message(
    display_name: str,
    elapsed_seconds: int,
    code: str,
    started_at: datetime,
) -> str:
    return (
        f"<b>{html.escape(display_name)}</b> finished the party puzzle in "
        f"<b>{format_elapsed(elapsed_seconds)}</b>.\n\n"
        f"Lobby: <code>{code}</code> · {format_game_when(started_at)}"
    )


async def notify_party_member_completed(
    bot: Bot,
    session: AsyncSession,
    game: Game,
) -> None:
    party_id = game.party_id
    if party_id is None:
        raise ValueError("party completion notify requires a party game")
    result = await session.execute(
        select(Party).where(Party.id == party_id).options(selectinload(Party.members)),
    )
    party = result.scalar_one_or_none()
    if party is None:
        raise RuntimeError(f"party not found: {party_id}")
    started_at = party.started_at
    if started_at is None:
        raise RuntimeError(f"party has no started_at: {party_id}")

    completer = next(
        (member for member in party.members if member.user_id == game.user_id),
        None,
    )
    if completer is None:
        raise RuntimeError(f"completer is not a party member: {game.user_id}")

    text = build_completion_message(
        completer.display_name,
        game.elapsed_seconds,
        party.code,
        started_at,
    )
    reply_markup: InlineKeyboardMarkup | None = None
    try:
        me = await bot.get_me()
        if me.username:
            reply_markup = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="View party results",
                            url=f"https://t.me/{me.username}?startapp=party_{party.id}",
                        ),
                    ],
                ],
            )
    except Exception:
        logger.exception("party notify: failed to build deep link")

    for member in party.members:
        if member.user_id == game.user_id:
            continue
        try:
            await bot.send_message(
                chat_id=member.user_id,
                text=text,
                parse_mode=ParseMode.HTML,
                reply_markup=reply_markup,
            )
        except Exception:
            logger.exception(
                "party notify: send failed user_id=%s party_id=%s",
                member.user_id,
                party_id,
            )
