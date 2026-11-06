from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Subquery

from app.models.enums import Difficulty, GameStatus
from app.models.game import Game
from app.models.user import User
from app.schemas.game import CompletionRecap
from app.schemas.user import (
    CleanBestLeaderboardEntry,
    CleanBestLeaderboardResponse,
    RatingDifficultyResponse,
)
from app.services.stats.rating_counters import rating_summaries_by_difficulty
from app.services.stats.scoring import CLEAN_WIN
from app.services.user_display_name import display_name_for_username

_LEADERBOARD_LIMIT = 10


async def build_clean_best_leaderboard(
    session: AsyncSession,
) -> CleanBestLeaderboardResponse:
    summaries = await rating_summaries_by_difficulty(session)

    async def rating_difficulty(difficulty: Difficulty) -> RatingDifficultyResponse:
        summary = summaries[difficulty]
        return RatingDifficultyResponse(
            entries=await _clean_rank_entries(session, difficulty),
            avg_clean_seconds=summary.avg_clean_seconds,
            games_started=summary.games_started,
            games_completed=summary.games_completed,
            clean_wins=summary.clean_wins,
        )

    return CleanBestLeaderboardResponse(
        easy=await rating_difficulty(Difficulty.easy),
        medium=await rating_difficulty(Difficulty.medium),
        hard=await rating_difficulty(Difficulty.hard),
    )


def _clean_best_per_user_subquery(difficulty: Difficulty) -> Subquery:
    ranked_seconds = func.min(Game.elapsed_seconds)
    return (
        select(
            Game.user_id.label("user_id"),
            ranked_seconds.label("best_time_seconds"),
            func.count().label("clean_games"),
        )
        .where(
            Game.difficulty == difficulty,
            CLEAN_WIN,
        )
        .group_by(Game.user_id)
        .subquery()
    )


async def build_completion_recap(
    session: AsyncSession,
    game: Game,
) -> CompletionRecap | None:
    if game.status != GameStatus.completed or game.is_analysis or game.is_lesson:
        return None
    clean = game.mistakes_count == 0 and game.hints_count == 0
    rating_rank, previous_rating_rank = await _rating_ranks_for_completion(session, game)
    return CompletionRecap(
        clean=clean,
        your_avg_clean_seconds=await _avg_clean_elapsed_seconds(
            session,
            difficulty=game.difficulty,
            user_id=game.user_id,
        ),
        global_avg_clean_seconds=await _global_avg_clean_elapsed_seconds(
            session,
            game.difficulty,
        ),
        rating_rank=rating_rank,
        previous_rating_rank=previous_rating_rank,
    )


async def _avg_clean_elapsed_seconds(
    session: AsyncSession,
    *,
    difficulty: Difficulty,
    user_id: int,
) -> int | None:
    average = await session.scalar(
        select(func.avg(Game.elapsed_seconds)).where(
            Game.difficulty == difficulty,
            Game.user_id == user_id,
            CLEAN_WIN,
        ),
    )
    if average is None:
        return None
    return int(average)


async def _global_avg_clean_elapsed_seconds(
    session: AsyncSession,
    difficulty: Difficulty,
) -> int | None:
    summaries = await rating_summaries_by_difficulty(session)
    return summaries[difficulty].avg_clean_seconds


async def _rating_ranks_for_completion(
    session: AsyncSession,
    game: Game,
) -> tuple[int | None, int | None]:
    if game.mistakes_count != 0 or game.hints_count != 0:
        return None, None
    previous_clean_best = await session.scalar(
        select(func.min(Game.elapsed_seconds)).where(
            Game.user_id == game.user_id,
            Game.difficulty == game.difficulty,
            CLEAN_WIN,
            Game.id != game.id,
        ),
    )
    rating_rank = await _rank_among_clean_bests(
        session,
        difficulty=game.difficulty,
        user_id=game.user_id,
        best_seconds=game.elapsed_seconds
        if previous_clean_best is None
        else min(game.elapsed_seconds, int(previous_clean_best)),
    )
    if previous_clean_best is None:
        return rating_rank, None
    previous_rating_rank = await _rank_among_clean_bests(
        session,
        difficulty=game.difficulty,
        user_id=game.user_id,
        best_seconds=int(previous_clean_best),
    )
    return rating_rank, previous_rating_rank


async def ejected_top10_user_id(session: AsyncSession, game: Game) -> int | None:
    if game.status != GameStatus.completed or game.is_analysis or game.is_lesson:
        return None
    rating_rank, previous_rating_rank = await _rating_ranks_for_completion(session, game)
    if rating_rank is None:
        return None
    entered_from_outside = (
        previous_rating_rank is None or previous_rating_rank > _LEADERBOARD_LIMIT
    ) and rating_rank <= _LEADERBOARD_LIMIT
    if not entered_from_outside:
        return None
    ranked_now = await _clean_best_user_count(session, game.difficulty)
    ranked_before = ranked_now - 1 if previous_rating_rank is None else ranked_now
    if ranked_before < _LEADERBOARD_LIMIT:
        return None
    return await _clean_best_user_id_at_rank(
        session,
        game.difficulty,
        _LEADERBOARD_LIMIT + 1,
    )


async def _clean_best_user_count(session: AsyncSession, difficulty: Difficulty) -> int:
    best_per_user = _clean_best_per_user_subquery(difficulty)
    count = await session.scalar(select(func.count()).select_from(best_per_user))
    if count is None:
        raise RuntimeError(f"clean-best user count missing for {difficulty}")
    return int(count)


async def _clean_best_user_id_at_rank(
    session: AsyncSession,
    difficulty: Difficulty,
    rank: int,
) -> int:
    best_per_user = _clean_best_per_user_subquery(difficulty)
    user_id = await session.scalar(
        select(best_per_user.c.user_id)
        .order_by(
            best_per_user.c.best_time_seconds.asc(),
            best_per_user.c.user_id.asc(),
        )
        .offset(rank - 1)
        .limit(1),
    )
    if user_id is None:
        raise RuntimeError(f"no clean-best user at rank {rank} for {difficulty}")
    return int(user_id)


async def _rank_among_clean_bests(
    session: AsyncSession,
    *,
    difficulty: Difficulty,
    user_id: int,
    best_seconds: int,
) -> int:
    best_per_user = _clean_best_per_user_subquery(difficulty)
    better_count = await session.scalar(
        select(func.count())
        .select_from(best_per_user)
        .where(
            best_per_user.c.user_id != user_id,
            or_(
                best_per_user.c.best_time_seconds < best_seconds,
                and_(
                    best_per_user.c.best_time_seconds == best_seconds,
                    best_per_user.c.user_id < user_id,
                ),
            ),
        ),
    )
    if better_count is None:
        raise RuntimeError("rating rank count missing")
    return int(better_count) + 1


async def _clean_rank_entries(
    session: AsyncSession,
    difficulty: Difficulty,
) -> list[CleanBestLeaderboardEntry]:
    ranked_per_user = _clean_best_per_user_subquery(difficulty)
    result = await session.execute(
        select(
            ranked_per_user.c.user_id,
            ranked_per_user.c.best_time_seconds,
            ranked_per_user.c.clean_games,
            User.username,
        )
        .join(User, User.id == ranked_per_user.c.user_id)
        .order_by(
            ranked_per_user.c.best_time_seconds.asc(),
            ranked_per_user.c.user_id.asc(),
        )
        .limit(_LEADERBOARD_LIMIT),
    )
    entries: list[CleanBestLeaderboardEntry] = []
    for rank, row in enumerate(result, start=1):
        clean_games = int(row.clean_games)
        if clean_games < 1:
            raise RuntimeError(f"leaderboard entry without clean games: user {row.user_id}")
        entries.append(
            CleanBestLeaderboardEntry(
                rank=rank,
                user_id=row.user_id,
                display_name=display_name_for_username(row.username),
                best_time_seconds=int(row.best_time_seconds),
                clean_games=clean_games,
            ),
        )
    return entries
