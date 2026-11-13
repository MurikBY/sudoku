import uuid

from sqlalchemy import ColumnElement, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import GameStatus
from app.models.game import Game
from app.services import clock
from app.services.games.errors import ElapsedExceedsGameAge, GameNotComplete
from app.services.games.queries import get_game_in_progress
from app.services.lesson_progress_service import record_if_objective_met
from app.services.sudoku.validator import matches_solution

ELAPSED_TOLERANCE_SECONDS = 5


def credit_play_time(game: Game, elapsed_seconds: int) -> None:
    # Out-of-order requests can report an earlier time; keep the stored value.
    if elapsed_seconds < game.elapsed_seconds:
        return
    game_age_seconds = (clock.utcnow() - game.started_at).total_seconds()
    if elapsed_seconds > game_age_seconds + ELAPSED_TOLERANCE_SECONDS:
        raise ElapsedExceedsGameAge("elapsed_seconds exceeds the time since the game started")
    game.elapsed_seconds = elapsed_seconds


def mark_game_abandoned(game: Game) -> None:
    game.status = GameStatus.abandoned


async def abandon_all_in_progress_games(session: AsyncSession, user_id: int) -> None:
    await _abandon_games_where(session, Game.user_id == user_id)


async def abandon_in_progress_analysis_games(session: AsyncSession, user_id: int) -> None:
    await _abandon_games_where(session, Game.user_id == user_id, Game.is_analysis.is_(True))


async def abandon_in_progress_lesson_games(session: AsyncSession, user_id: int) -> None:
    await _abandon_games_where(session, Game.user_id == user_id, Game.is_lesson.is_(True))


async def _abandon_games_where(session: AsyncSession, *conditions: ColumnElement[bool]) -> None:
    # Same id order on every call, so two abandons cannot deadlock on several rows.
    result = await session.execute(
        select(Game)
        .where(Game.status == GameStatus.in_progress, *conditions)
        .order_by(Game.id)
        .with_for_update(),
    )
    for game in result.scalars():
        mark_game_abandoned(game)


async def sync_elapsed_seconds(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    elapsed_seconds: int,
) -> Game:
    game = await get_game_in_progress(session, user_id, game_id, for_update=True)
    credit_play_time(game, elapsed_seconds)
    await session.commit()
    return game


async def complete_game(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    elapsed_seconds: int,
) -> Game:
    game = await get_game_in_progress(session, user_id, game_id, for_update=True)
    if not matches_solution(game.current_grid, game.solution):
        raise GameNotComplete("game grid does not match solution")

    credit_play_time(game, elapsed_seconds)
    game.status = GameStatus.completed
    game.completed_at = clock.utcnow()

    await record_if_objective_met(session, game)
    await session.commit()
    return game


async def abandon_game(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    elapsed_seconds: int,
) -> Game:
    game = await get_game_in_progress(session, user_id, game_id, for_update=True)
    credit_play_time(game, elapsed_seconds)
    mark_game_abandoned(game)
    await session.commit()
    return game
