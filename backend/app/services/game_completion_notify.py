import logging
from dataclasses import dataclass

from aiogram import Bot
from sqlalchemy.ext.asyncio import AsyncSession

from app.background import spawn
from app.models.enums import Difficulty
from app.models.game import Game
from app.schemas.game import CompletionRecap
from app.services import top10_drop_cooldown as top10_drop_cooldowns
from app.services.party_notify import (
    PartyCompletionNotice,
    build_party_completion_notice,
    send_party_completion_notice,
)
from app.services.rating_notify import send_top10_drop_message
from app.services.stats.clean_best import (
    CompletionRanks,
    build_completion_recap,
    completion_ranks,
    ejected_top10_user_id,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CompletionNotices:
    difficulty: Difficulty
    party: PartyCompletionNotice | None
    top10_dropped_user_id: int | None


async def announce_completion(
    bot: Bot | None,
    session: AsyncSession,
    game: Game,
) -> CompletionRecap | None:
    # One rank lookup serves the player's recap and the Top 10 drop message.
    ranks = await completion_ranks(session, game)
    await _schedule_completion_notices(bot, session, game, ranks)
    return await build_completion_recap(session, game, ranks)


async def _schedule_completion_notices(
    bot: Bot | None,
    session: AsyncSession,
    game: Game,
    ranks: CompletionRanks,
) -> None:
    # Recipients are read inside the request; the Bot API calls run after the response.
    if bot is None:
        return
    notices = CompletionNotices(
        difficulty=game.difficulty,
        party=await _party_notice(session, game),
        top10_dropped_user_id=await _top10_dropped_user_id(session, game, ranks),
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


async def _top10_dropped_user_id(
    session: AsyncSession,
    game: Game,
    ranks: CompletionRanks,
) -> int | None:
    try:
        dropped_user_id = await ejected_top10_user_id(session, game, ranks)
    except Exception:
        logger.exception("top10 drop notify failed game_id=%s", game.id)
        return None
    if dropped_user_id is None:
        return None
    if not top10_drop_cooldowns.top10_drop_cooldown.claim(dropped_user_id, game.difficulty):
        logger.info("top10 drop notify skipped by cooldown user_id=%s", dropped_user_id)
        return None
    return dropped_user_id


async def _send_completion_notices(bot: Bot, notices: CompletionNotices) -> None:
    if notices.party is not None:
        await send_party_completion_notice(bot, notices.party)
    if notices.top10_dropped_user_id is not None:
        await send_top10_drop_message(bot, notices.top10_dropped_user_id, notices.difficulty)
