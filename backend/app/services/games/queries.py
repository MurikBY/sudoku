import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import Difficulty, GameStatus
from app.models.game import SCORED_GAME, Game
from app.services.games.errors import GameNotFound, GameNotInProgress
from app.services.user_display_name import display_name_for_username


@dataclass(frozen=True)
class GameHistoryEntry:
    game: Game
    display_name: str


async def get_game(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Game:
    game = await session.get(Game, game_id, with_for_update=for_update)
    if game is None or game.user_id != user_id:
        raise GameNotFound(f"game not found: {game_id}")
    return game


async def get_game_in_progress(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Game:
    game = await get_game(session, user_id, game_id, for_update=for_update)
    if game.status != GameStatus.in_progress:
        raise GameNotInProgress(f"game is not in progress: {game.id}")
    return game


async def get_resumable_game(session: AsyncSession, user_id: int) -> Game | None:
    result = await session.execute(
        select(Game)
        .where(
            Game.user_id == user_id,
            Game.status == GameStatus.in_progress,
            SCORED_GAME,
        )
        .order_by(Game.started_at.desc())
        .limit(1),
    )
    return result.scalar_one_or_none()


async def list_finished_game_history(
    session: AsyncSession,
    user_id: int,
    limit: int,
    offset: int,
    difficulty: Difficulty | None = None,
    status: GameStatus | None = None,
) -> tuple[list[GameHistoryEntry], int]:
    conditions = [
        Game.user_id == user_id,
        SCORED_GAME,
    ]
    if difficulty is not None:
        conditions.append(Game.difficulty == difficulty)
    if status is not None:
        conditions.append(Game.status == status)
    total_result = await session.execute(
        select(func.count()).select_from(Game).where(*conditions),
    )
    total = int(total_result.scalar_one())
    result = await session.execute(
        select(Game)
        .options(selectinload(Game.user))
        .where(*conditions)
        .order_by(Game.started_at.desc())
        .limit(limit)
        .offset(offset),
    )
    games = list(result.scalars())
    entries = [
        GameHistoryEntry(
            game=game,
            display_name=display_name_for_username(game.user.username),
        )
        for game in games
    ]
    return entries, total
