from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import Case, ColumnElement, Row, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.models.enums import Difficulty, GameStatus
from app.models.game import SCORED_GAME, Game
from app.models.user import User
from app.schemas.user import (
    DifficultyStatsResponse,
    StatsByDifficultyResponse,
    UserStatsResponse,
)
from app.services import clock
from app.services.stats.scoring import CLEAN_WIN, DIFFICULTIES, FINISHED


class StatsPeriod(StrEnum):
    all = "all"
    month = "month"
    week = "week"


_PERIOD_DAYS = {
    StatsPeriod.month: 30,
    StatsPeriod.week: 7,
}


@dataclass(frozen=True)
class _DifficultyAggregate:
    games_started: int
    games_completed: int
    games_finished: int
    clean_wins: int
    total_play_seconds: int
    avg_completion_seconds: int | None
    best_time_seconds: int | None
    best_time_clean_seconds: int | None
    avg_clean_seconds: int | None
    avg_hints: float | None
    avg_pencil: float | None


def period_started_at_cutoff(
    period: StatsPeriod,
    *,
    now: datetime | None = None,
) -> datetime | None:
    if period is StatsPeriod.all:
        return None
    reference = now if now is not None else clock.utcnow()
    return reference - timedelta(days=_PERIOD_DAYS[period])


async def build_user_stats(
    session: AsyncSession,
    user: User,
    period: StatsPeriod = StatsPeriod.all,
) -> UserStatsResponse:
    started_at_cutoff = period_started_at_cutoff(period)
    aggregates = await _aggregates_by_difficulty(session, user.id, started_at_cutoff)
    games_started = sum(aggregate.games_started for aggregate in aggregates.values())
    games_completed = sum(aggregate.games_completed for aggregate in aggregates.values())
    clean_wins = sum(aggregate.clean_wins for aggregate in aggregates.values())
    total_play_seconds = sum(aggregate.total_play_seconds for aggregate in aggregates.values())
    avg_completion_seconds = await _overall_avg_completion_seconds(
        session,
        user.id,
        started_at_cutoff,
    )
    return UserStatsResponse(
        games_started=games_started,
        games_completed=games_completed,
        clean_wins=clean_wins,
        win_rate=_win_rate(games_completed, games_started),
        clean_win_rate=_win_rate(clean_wins, games_started),
        total_play_seconds=total_play_seconds,
        avg_completion_seconds=avg_completion_seconds,
        avg_hints=_weighted_finished_avg(aggregates, lambda item: item.avg_hints),
        avg_pencil=_weighted_finished_avg(aggregates, lambda item: item.avg_pencil),
        by_difficulty=_stats_by_difficulty(aggregates),
    )


async def _overall_avg_completion_seconds(
    session: AsyncSession,
    user_id: int,
    started_at_cutoff: datetime | None,
) -> int | None:
    conditions = [
        Game.user_id == user_id,
        Game.status == GameStatus.completed,
        SCORED_GAME,
    ]
    if started_at_cutoff is not None:
        conditions.append(Game.started_at >= started_at_cutoff)
    result = await session.execute(select(func.avg(Game.elapsed_seconds)).where(*conditions))
    average = result.scalar_one_or_none()
    if average is None:
        return None
    return int(average)


async def _aggregates_by_difficulty(
    session: AsyncSession,
    user_id: int,
    started_at_cutoff: datetime | None,
) -> dict[Difficulty, _DifficultyAggregate]:
    conditions = [
        Game.user_id == user_id,
        SCORED_GAME,
    ]
    if started_at_cutoff is not None:
        conditions.append(Game.started_at >= started_at_cutoff)
    result = await session.execute(
        select(Game.difficulty, *_aggregate_columns()).where(*conditions).group_by(Game.difficulty),
    )
    aggregates = {difficulty: _empty_aggregate() for difficulty in DIFFICULTIES}
    for row in result:
        aggregates[row.difficulty] = _aggregate_from_row(row)
    return aggregates


def _when(condition: ColumnElement[bool], column: InstrumentedAttribute[int]) -> Case[int]:
    return case((condition, column), else_=None)


def _aggregate_columns() -> tuple[ColumnElement[Any], ...]:
    completed = Game.status == GameStatus.completed
    return (
        func.count().label("games_started"),
        func.count().filter(completed).label("games_completed"),
        func.count().filter(FINISHED).label("games_finished"),
        func.count().filter(CLEAN_WIN).label("clean_wins"),
        func.coalesce(func.sum(Game.elapsed_seconds), 0).label("total_play_seconds"),
        func.avg(_when(completed, Game.elapsed_seconds)).label("avg_completion_seconds"),
        func.min(_when(completed, Game.elapsed_seconds)).label("best_time_seconds"),
        func.min(_when(CLEAN_WIN, Game.elapsed_seconds)).label("best_time_clean_seconds"),
        func.avg(_when(CLEAN_WIN, Game.elapsed_seconds)).label("avg_clean_seconds"),
        func.avg(_when(FINISHED, Game.hints_count)).label("avg_hints"),
        func.avg(_when(FINISHED, Game.pencil_count)).label("avg_pencil"),
    )


def _aggregate_from_row(row: Row[Any]) -> _DifficultyAggregate:
    return _DifficultyAggregate(
        games_started=row.games_started,
        games_completed=row.games_completed,
        games_finished=row.games_finished,
        clean_wins=row.clean_wins,
        total_play_seconds=int(row.total_play_seconds),
        avg_completion_seconds=_optional_seconds(row.avg_completion_seconds),
        best_time_seconds=_optional_seconds(row.best_time_seconds),
        best_time_clean_seconds=_optional_seconds(row.best_time_clean_seconds),
        avg_clean_seconds=_optional_seconds(row.avg_clean_seconds),
        avg_hints=_optional_avg(row.avg_hints),
        avg_pencil=_optional_avg(row.avg_pencil),
    )


def _optional_seconds(value: Decimal | int | None) -> int | None:
    if value is None:
        return None
    return int(value)


def _stats_by_difficulty(
    aggregates: dict[Difficulty, _DifficultyAggregate],
) -> StatsByDifficultyResponse:
    return StatsByDifficultyResponse(
        easy=_difficulty_stats_response(aggregates[Difficulty.easy]),
        medium=_difficulty_stats_response(aggregates[Difficulty.medium]),
        hard=_difficulty_stats_response(aggregates[Difficulty.hard]),
    )


def _difficulty_stats_response(aggregate: _DifficultyAggregate) -> DifficultyStatsResponse:
    return DifficultyStatsResponse(
        games_started=aggregate.games_started,
        games_completed=aggregate.games_completed,
        clean_wins=aggregate.clean_wins,
        win_rate=_win_rate(aggregate.games_completed, aggregate.games_started),
        clean_win_rate=_win_rate(aggregate.clean_wins, aggregate.games_started),
        total_play_seconds=aggregate.total_play_seconds,
        avg_completion_seconds=aggregate.avg_completion_seconds,
        best_time_seconds=aggregate.best_time_seconds,
        best_time_clean_seconds=aggregate.best_time_clean_seconds,
        avg_clean_seconds=aggregate.avg_clean_seconds,
        avg_hints=aggregate.avg_hints,
        avg_pencil=aggregate.avg_pencil,
    )


def _win_rate(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def _optional_avg(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 1)


def _weighted_finished_avg(
    aggregates: dict[Difficulty, _DifficultyAggregate],
    read_avg: Callable[[_DifficultyAggregate], float | None],
) -> float | None:
    weighted_total = 0.0
    finished_total = 0
    for aggregate in aggregates.values():
        average = read_avg(aggregate)
        if average is None or aggregate.games_finished == 0:
            continue
        weighted_total += average * aggregate.games_finished
        finished_total += aggregate.games_finished
    if finished_total == 0:
        return None
    return round(weighted_total / finished_total, 1)


def _empty_aggregate() -> _DifficultyAggregate:
    return _DifficultyAggregate(
        games_started=0,
        games_completed=0,
        games_finished=0,
        clean_wins=0,
        total_play_seconds=0,
        avg_completion_seconds=None,
        best_time_seconds=None,
        best_time_clean_seconds=None,
        avg_clean_seconds=None,
        avg_hints=None,
        avg_pencil=None,
    )
