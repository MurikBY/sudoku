import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Difficulty, GameStatus
from app.models.game import Game
from app.models.user import User
from app.schemas.preferences import GameAssistsPayload
from app.services import puzzle_pool_service
from app.services.game_events import allocate_share_code
from app.services.games.lifecycle import abandon_all_in_progress_games
from app.services.preferences_service import preferences_from_user
from app.services.sudoku.puzzle import GeneratedPuzzle


async def build_game_from_puzzle(
    session: AsyncSession,
    user_id: int,
    generated: GeneratedPuzzle,
    *,
    assists: GameAssistsPayload,
    party_id: uuid.UUID | None = None,
) -> Game:
    share_code = await allocate_share_code(session)
    game = Game(
        user_id=user_id,
        difficulty=generated.difficulty,
        status=GameStatus.in_progress,
        puzzle=generated.puzzle,
        solution=generated.solution,
        current_grid=generated.puzzle,
        assists=assists.model_dump(mode="json"),
        share_code=share_code,
    )
    if party_id is not None:
        game.party_id = party_id
    return game


async def create_game(
    session: AsyncSession,
    user: User,
    difficulty: Difficulty,
) -> Game:
    await abandon_all_in_progress_games(session, user.id)
    generated = await puzzle_pool_service.take_puzzle_for_play(
        session,
        difficulty,
        taker_id=user.id,
    )
    assists = preferences_from_user(user).assists
    game = await build_game_from_puzzle(
        session,
        user.id,
        generated,
        assists=assists,
    )
    session.add(game)
    await session.commit()
    await session.refresh(game)
    return game
