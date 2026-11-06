import functools
from collections.abc import Sequence
from pathlib import Path

from pydantic import TypeAdapter

from app.models.enums import LessonRole
from app.services.sudoku.lessons.models import (
    LESSON_POOL_SIZE,
    LESSON_TECHNIQUES,
    LessonPosition,
)

# This file is app/services/sudoku/lessons/store.py, so parents[3] is app/.
LESSONS_DIR = Path(__file__).resolve().parents[3] / "data" / "lessons"
_positions_adapter: TypeAdapter[list[LessonPosition]] = TypeAdapter(list[LessonPosition])


@functools.cache
def load_pool(technique: str) -> tuple[LessonPosition, ...]:
    if technique not in LESSON_TECHNIQUES:
        raise ValueError(f"unknown lesson technique: {technique}")
    path = LESSONS_DIR / f"{technique}.json"
    if not path.is_file():
        raise FileNotFoundError(f"missing lesson pool: {path}")
    positions = _positions_adapter.validate_json(path.read_text())
    require_pool_shape(technique, positions)
    return tuple(positions)


def taught_position(technique: str) -> LessonPosition:
    for position in load_pool(technique):
        if position.role == LessonRole.taught:
            return position
    raise ValueError(f"{technique} lesson pool must have exactly one taught position")


def position_by_id(technique: str, position_id: str) -> LessonPosition:
    for position in load_pool(technique):
        if position.id == position_id:
            return position
    raise ValueError(f"unknown lesson position: {position_id}")


def require_pool_shape(technique: str, positions: Sequence[LessonPosition]) -> None:
    if len(positions) != LESSON_POOL_SIZE:
        raise ValueError(
            f"{technique} lesson pool must have {LESSON_POOL_SIZE} positions, got {len(positions)}",
        )
    ids = [position.id for position in positions]
    if any(not position_id for position_id in ids):
        raise ValueError("lesson field id must be a non-empty string")
    if len(set(ids)) != len(ids):
        raise ValueError(f"{technique} lesson pool has duplicate ids")
    taught = [position for position in positions if position.role == LessonRole.taught]
    if len(taught) != 1:
        raise ValueError(f"{technique} lesson pool must have exactly one taught position")
    for position in positions:
        if position.technique != technique:
            raise ValueError(
                f"{technique} pool contains {position.technique} position {position.id}",
            )
