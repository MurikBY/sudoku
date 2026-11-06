from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import GameStatus
from app.models.game import Game
from app.models.user import User
from app.schemas.preferences import GameAssistsPayload
from app.services.game_events import allocate_share_code, replay_events_to_state
from app.services.games.errors import GameReviewUnavailable
from app.services.games.lifecycle import abandon_in_progress_analysis_games
from app.services.games.review import get_game_review_by_code
from app.services.games.stored_state import dump_notes


async def create_analysis_game(
    session: AsyncSession,
    user: User,
    share_code: str,
    event_index: int,
) -> Game:
    review = await get_game_review_by_code(session, share_code)
    source = review.game
    if source.status == GameStatus.in_progress and source.user_id == user.id:
        raise GameReviewUnavailable(
            "cannot analyze your own in-progress game",
        )
    events = list(source.events)
    try:
        grid, notes = replay_events_to_state(source.puzzle, events, event_index)
    except ValueError as error:
        raise GameReviewUnavailable(str(error)) from error

    await abandon_in_progress_analysis_games(session, user.id)
    assists = GameAssistsPayload.model_validate(source.assists)
    analysis_code = await allocate_share_code(session)
    game = Game(
        user_id=user.id,
        difficulty=source.difficulty,
        status=GameStatus.in_progress,
        puzzle=source.puzzle,
        solution=source.solution,
        current_grid=grid,
        assists=assists.model_dump(mode="json"),
        share_code=analysis_code,
        is_analysis=True,
        analysis_source_game_id=source.id,
    )
    if notes:
        game.notes = dump_notes(notes)
    session.add(game)
    await session.commit()
    await session.refresh(game)
    return game
