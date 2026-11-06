from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.models.lesson_progress import LessonProgress
from app.services import clock
from app.services.sudoku.lessons.models import LESSON_TECHNIQUES
from app.services.sudoku.lessons.runtime import lesson_runtime
from app.services.sudoku.lessons.store import load_pool


@dataclass(frozen=True)
class TechniqueProgress:
    technique: str
    pool_size: int
    solved_count: int


def _lesson_identity(game: Game) -> tuple[str, str]:
    technique = game.lesson_technique
    position_id = game.lesson_position_id
    if technique is None or position_id is None:
        raise RuntimeError(f"lesson game {game.id} missing technique or position")
    return technique, position_id


def _objective_met(technique: str, position_id: str, game: Game) -> bool:
    runtime = lesson_runtime(
        technique,
        position_id,
        game.current_grid,
        dict(game.notes),
    )
    return runtime.objective_met


def lesson_objective_is_met(game: Game) -> bool:
    if not game.is_lesson:
        return False
    technique, position_id = _lesson_identity(game)
    return _objective_met(technique, position_id, game)


async def record_if_objective_met(session: AsyncSession, game: Game) -> None:
    if not game.is_lesson:
        return
    if game.hints_count > 0:
        return
    technique, position_id = _lesson_identity(game)
    if not _objective_met(technique, position_id, game):
        return
    await session.execute(
        insert(LessonProgress)
        .values(
            user_id=game.user_id,
            technique=technique,
            position_id=position_id,
            completed_at=clock.utcnow(),
        )
        .on_conflict_do_nothing(
            index_elements=["user_id", "technique", "position_id"],
        ),
    )


async def drop_progress_cleared_by_undo(
    session: AsyncSession,
    game: Game,
    objective_was_met: bool,
) -> None:
    if not game.is_lesson:
        return
    if not objective_was_met:
        return
    technique, position_id = _lesson_identity(game)
    if _objective_met(technique, position_id, game):
        return
    # A repeated insert does not move completed_at, so an earlier game's row is older
    # than this game's started_at and stays.
    await session.execute(
        delete(LessonProgress).where(
            LessonProgress.user_id == game.user_id,
            LessonProgress.technique == technique,
            LessonProgress.position_id == position_id,
            LessonProgress.completed_at >= game.started_at,
        ),
    )


async def progress_for_user(session: AsyncSession, user_id: int) -> list[TechniqueProgress]:
    counted = await session.execute(
        select(LessonProgress.technique, func.count())
        .where(LessonProgress.user_id == user_id)
        .group_by(LessonProgress.technique),
    )
    solved_by_technique = dict(counted.tuples().all())
    items: list[TechniqueProgress] = []
    for technique in LESSON_TECHNIQUES:
        items.append(
            TechniqueProgress(
                technique=technique,
                pool_size=len(load_pool(technique)),
                solved_count=solved_by_technique.get(technique, 0),
            ),
        )
    return items
