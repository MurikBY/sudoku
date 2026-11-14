from __future__ import annotations

import logging

from aiogram import Bot

from app.models.enums import Difficulty

logger = logging.getLogger(__name__)


def build_top10_drop_message(difficulty: Difficulty) -> str:
    return (
        f"You were pushed out of the {difficulty.value.capitalize()} Top 10. "
        "Play a clean game to climb back."
    )


async def send_top10_drop_message(bot: Bot, user_id: int, difficulty: Difficulty) -> None:
    try:
        await bot.send_message(chat_id=user_id, text=build_top10_drop_message(difficulty))
    except Exception:
        logger.exception("top10 drop notify: send failed user_id=%s", user_id)
    else:
        logger.info("top10 drop notify: sent user_id=%s difficulty=%s", user_id, difficulty.value)
