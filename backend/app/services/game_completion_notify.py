import logging
from dataclasses import dataclass

from aiogram import Bot
from sqlalchemy.ext.asyncio import AsyncSession

from app.background import spawn
from app.models.enums import Difficulty
from app.models.game import Game
from app.services.party_notify import (
    PartyCompletionNotice,
    build_party_completion_notice,
    send_party_completion_notice,
)
from app.services.rating_notify import send_top10_drop_message
from app.services.stats.clean_best import ejected_top10_user_id

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CompletionNotices:
    difficulty: Difficulty
    party: PartyCompletionNotice | None
    top10_dropped_user_id: int | None


async def schedule_completion_notices(bot: Bot | None, session: AsyncSession, game: Game) -> None:
    # Recipients are read inside the request; the Bot API calls run after the response.
    if bot is None:
        return
    notices = CompletionNotices(
        difficulty=game.difficulty,
        party=await _party_notice(session, game),
        top10_dropped_user_id=await _top10_dropped_user_id(session, game),
    )
    spawn(_send_completion_notices(bot, notices), name=f"completion-notices-{game.id}")


async def _party_notice(session: AsyncSession, game: Game) -> PartyCompletionNotice | None:
    if game.party_id is None:
        return None
    try:
        return await build_party_completion_notice(session, game)
    except Exception:
        logger.exception("party completion notify failed game_id=%s", game.id)
        return None


async def _top10_dropped_user_id(session: AsyncSession, game: Game) -> int | None:
    try:
        return await ejected_top10_user_id(session, game)
    except Exception:
        logger.exception("top10 drop notify failed game_id=%s", game.id)
        return None


async def _send_completion_notices(bot: Bot, notices: CompletionNotices) -> None:
    if notices.party is not None:
        await send_party_completion_notice(bot, notices.party)
    if notices.top10_dropped_user_id is not None:
        await send_top10_drop_message(bot, notices.top10_dropped_user_id, notices.difficulty)
