import logging

from aiogram import Bot
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.services.party_notify import notify_party_member_completed
from app.services.rating_notify import notify_if_dropped_from_top10

logger = logging.getLogger(__name__)


async def notify_game_completed(bot: Bot | None, session: AsyncSession, game: Game) -> None:
    if bot is None:
        return
    if game.party_id is not None:
        try:
            await notify_party_member_completed(bot, session, game)
        except Exception:
            logger.exception("party completion notify failed game_id=%s", game.id)
    try:
        await notify_if_dropped_from_top10(bot, session, game)
    except Exception:
        logger.exception("top10 drop notify failed game_id=%s", game.id)
