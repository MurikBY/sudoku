import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.game import Game
from app.services.games.errors import GameNotFound
from app.services.user_display_name import display_name_for_username


@dataclass(frozen=True)
class GameReview:
    game: Game
    display_name: str
    replay_available: bool


async def get_game_review_for_owner(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
) -> GameReview:
    result = await session.execute(
        select(Game)
        .options(selectinload(Game.user))
        .where(Game.id == game_id, Game.user_id == user_id),
    )
    game = result.scalar_one_or_none()
    if game is None or game.is_analysis or game.is_lesson:
        raise GameNotFound(f"game not found: {game_id}")
    return GameReview(
        game=game,
        display_name=display_name_for_username(game.user.username),
        replay_available=bool(game.events),
    )


async def get_game_review_by_code(
    session: AsyncSession,
    code: str,
) -> GameReview:
    normalized = code.strip().upper()
    result = await session.execute(
        select(Game).options(selectinload(Game.user)).where(Game.share_code == normalized),
    )
    game = result.scalar_one_or_none()
    if game is None or game.is_analysis or game.is_lesson:
        raise GameNotFound(f"game not found: {normalized}")
    return GameReview(
        game=game,
        display_name=display_name_for_username(game.user.username),
        replay_available=bool(game.events),
    )
