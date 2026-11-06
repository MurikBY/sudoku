from __future__ import annotations

import logging

from aiogram import Bot
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Difficulty
from app.models.game import Game
from app.services.stats.clean_best import ejected_top10_user_id

logger = logging.getLogger(__name__)


def build_top10_drop_message(difficulty: Difficulty) -> str:
    return (
        f"You were pushed out of the {difficulty.value.capitalize()} Top 10. "
        "Play a clean game to climb back."
    )


async def notify_if_dropped_from_top10(
    bot: Bot,
    session: AsyncSession,
    game: Game,
) -> None:
    dropped_user_id = await ejected_top10_user_id(session, game)
    if dropped_user_id is None:
        return
    try:
        await bot.send_message(
            chat_id=dropped_user_id,
            text=build_top10_drop_message(game.difficulty),
        )
    except Exception:
        logger.exception(
            "top10 drop notify: send failed user_id=%s game_id=%s",
            dropped_user_id,
            game.id,
        )
