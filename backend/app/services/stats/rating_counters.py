from dataclasses import dataclass

from sqlalchemy import case, func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.enums import Difficulty, GameStatus
from app.models.game import SCORED_GAME, Game
from app.models.rating_counter_archive import RatingCounterArchive
from app.services.archived_rating_totals import (
    ArchivedRatingTotals,
    add_archived_rating_totals,
)
from app.services.stats.scoring import CLEAN_WIN, DIFFICULTIES


@dataclass(frozen=True)
class _RatingDifficultySummary:
    games_started: int
    games_completed: int
    clean_wins: int
    avg_clean_seconds: int | None


def _scored_game_counter_columns() -> tuple[ColumnElement[int], ...]:
    return (
        func.count().label("games_started"),
        func.count().filter(Game.status == GameStatus.completed).label("games_completed"),
        func.count().filter(CLEAN_WIN).label("clean_wins"),
        func.coalesce(
            func.sum(
                case(
                    (CLEAN_WIN, Game.elapsed_seconds),
                    else_=None,
                ),
            ),
            0,
        ).label("clean_elapsed_sum"),
    )


async def _rating_counter_archives(
    session: AsyncSession,
) -> dict[Difficulty, ArchivedRatingTotals]:
    rows = (
        await session.scalars(
            select(RatingCounterArchive).execution_options(populate_existing=True),
        )
    ).all()
    archives = {
        row.difficulty: ArchivedRatingTotals(
            games_started=row.games_started,
            games_completed=row.games_completed,
            clean_wins=row.clean_wins,
            clean_elapsed_sum=row.clean_elapsed_sum,
        )
        for row in rows
    }
    missing = [difficulty.value for difficulty in DIFFICULTIES if difficulty not in archives]
    if missing:
        raise RuntimeError(
            f"rating counter archive missing {', '.join(missing)}",
        )
    return archives


async def rating_summaries_by_difficulty(
    session: AsyncSession,
) -> dict[Difficulty, _RatingDifficultySummary]:
    archives = await _rating_counter_archives(session)
    result = await session.execute(
        select(Game.difficulty, *_scored_game_counter_columns())
        .where(SCORED_GAME)
        .group_by(Game.difficulty),
    )
    summaries = {
        difficulty: _summary_with_archive(
            games_started=0,
            games_completed=0,
            clean_wins=0,
            clean_elapsed_sum=0,
            archive=archives[difficulty],
        )
        for difficulty in DIFFICULTIES
    }
    for row in result:
        summaries[row.difficulty] = _summary_with_archive(
            games_started=int(row.games_started),
            games_completed=int(row.games_completed),
            clean_wins=int(row.clean_wins),
            clean_elapsed_sum=int(row.clean_elapsed_sum),
            archive=archives[row.difficulty],
        )
    return summaries


async def fold_user_scored_games_into_rating_counters(
    session: AsyncSession,
    user_id: int,
) -> None:
    result = await session.execute(
        select(Game.difficulty, *_scored_game_counter_columns())
        .where(SCORED_GAME, Game.user_id == user_id)
        .group_by(Game.difficulty),
    )
    for row in result:
        updated = await session.execute(
            update(RatingCounterArchive)
            .where(RatingCounterArchive.difficulty == row.difficulty)
            .values(
                games_started=RatingCounterArchive.games_started + int(row.games_started),
                games_completed=(RatingCounterArchive.games_completed + int(row.games_completed)),
                clean_wins=RatingCounterArchive.clean_wins + int(row.clean_wins),
                clean_elapsed_sum=(
                    RatingCounterArchive.clean_elapsed_sum + int(row.clean_elapsed_sum)
                ),
            ),
        )
        if not isinstance(updated, CursorResult):
            raise RuntimeError(
                f"rating counter update returned no row count for {row.difficulty.value}",
            )
        if updated.rowcount != 1:
            raise RuntimeError(
                f"rating counter archive missing {row.difficulty.value}",
            )


def _summary_with_archive(
    *,
    games_started: int,
    games_completed: int,
    clean_wins: int,
    clean_elapsed_sum: int,
    archive: ArchivedRatingTotals,
) -> _RatingDifficultySummary:
    started, completed, clean, avg_clean_seconds = add_archived_rating_totals(
        games_started=games_started,
        games_completed=games_completed,
        clean_wins=clean_wins,
        clean_elapsed_sum=clean_elapsed_sum,
        archive=archive,
    )
    return _RatingDifficultySummary(
        games_started=started,
        games_completed=completed,
        clean_wins=clean,
        avg_clean_seconds=avg_clean_seconds,
    )
