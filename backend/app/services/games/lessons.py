import secrets
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Difficulty, GameStatus, LessonRole
from app.models.game import Game
from app.models.user import User
from app.services.game_events import allocate_share_code
from app.services.games.errors import LessonPracticeUnavailable, LessonTechniqueUnknown
from app.services.games.lifecycle import abandon_in_progress_lesson_games
from app.services.games.stored_state import dump_notes
from app.services.preferences_service import preferences_from_user
from app.services.sudoku.lessons.models import LESSON_TECHNIQUES, PENCIL_LESSON, LessonPosition
from app.services.sudoku.lessons.store import load_pool, taught_position
from app.services.sudoku.technique import EASY_TECHNIQUES, MEDIUM_TECHNIQUES, Technique


def _require_lesson_technique(technique: str) -> None:
    if technique not in LESSON_TECHNIQUES:
        raise LessonTechniqueUnknown(f"unknown lesson technique: {technique}")


@dataclass(frozen=True)
class TaughtLesson:
    position: LessonPosition
    has_practice: bool


def get_taught_lesson(technique: str) -> TaughtLesson:
    _require_lesson_technique(technique)
    positions = load_pool(technique)
    return TaughtLesson(
        position=taught_position(technique),
        has_practice=any(position.role == LessonRole.practice for position in positions),
    )


def _lesson_position(
    technique: str,
    role: LessonRole,
    exclude_position_id: str | None = None,
) -> LessonPosition:
    _require_lesson_technique(technique)
    if role is LessonRole.taught:
        return taught_position(technique)
    positions = load_pool(technique)
    if exclude_position_id is not None:
        positions = tuple(position for position in positions if position.id != exclude_position_id)
        if not positions:
            raise LessonPracticeUnavailable(
                f"no other snapshot for {technique} besides {exclude_position_id}"
            )
    return secrets.choice(positions)


def _lesson_difficulty(technique: str) -> Difficulty:
    if technique == PENCIL_LESSON:
        return Difficulty.easy
    named = Technique(technique)
    if named in EASY_TECHNIQUES:
        return Difficulty.easy
    if named in MEDIUM_TECHNIQUES:
        return Difficulty.medium
    return Difficulty.hard


async def create_lesson_game(
    session: AsyncSession,
    user: User,
    technique: str,
    role: LessonRole,
    exclude_position_id: str | None = None,
) -> Game:
    position = _lesson_position(technique, role, exclude_position_id)
    await abandon_in_progress_lesson_games(session, user.id)
    share_code = await allocate_share_code(session)
    starting_notes = {key: list(digits) for key, digits in position.notes.items()}
    assists = preferences_from_user(user).assists
    game = Game(
        user_id=user.id,
        difficulty=_lesson_difficulty(technique),
        status=GameStatus.in_progress,
        puzzle=position.grid,
        solution=position.solution,
        current_grid=position.grid,
        assists=assists.model_dump(mode="json"),
        share_code=share_code,
        is_lesson=True,
        lesson_technique=technique,
        lesson_position_id=position.id,
    )
    if starting_notes:
        game.notes = dump_notes(starting_notes)
    session.add(game)
    await session.commit()
    return game
