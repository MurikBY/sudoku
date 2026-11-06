from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.models.lesson_progress import LessonProgress
from app.models.party import PartyMember
from app.models.user import User
from app.services.stats.rating_counters import fold_user_scored_games_into_rating_counters


async def reset_user_play_data(session: AsyncSession, user: User) -> None:
    await fold_user_scored_games_into_rating_counters(session, user.id)
    await session.execute(delete(PartyMember).where(PartyMember.user_id == user.id))
    await session.execute(delete(Game).where(Game.user_id == user.id))
    await session.execute(delete(LessonProgress).where(LessonProgress.user_id == user.id))

    user.play_lock_token = None
    user.play_lock_expires_at = None

    await session.commit()
    await session.refresh(user)
