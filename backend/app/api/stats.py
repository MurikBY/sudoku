from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.user import CleanBestLeaderboardResponse, UserStatsResponse
from app.services.stats.clean_best import build_clean_best_leaderboard
from app.services.stats.user_stats import StatsPeriod, build_user_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=UserStatsResponse)
async def get_stats(
    current_user: CurrentUser,
    session: DbSession,
    period: StatsPeriod = Query(default=StatsPeriod.all),
) -> UserStatsResponse:
    return await build_user_stats(session, current_user, period)


@router.get("/rating", response_model=CleanBestLeaderboardResponse)
async def get_clean_best_rating(
    current_user: CurrentUser,
    session: DbSession,
) -> CleanBestLeaderboardResponse:
    _ = current_user
    return await build_clean_best_leaderboard(session)
