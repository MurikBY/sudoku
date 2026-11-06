import pytest

from app.services.sudoku.coach_step import find_next_notes_issue, locate_next_technique_step
from app.services.sudoku.lessons.models import (
    LESSON_TECHNIQUES,
    PENCIL_LESSON,
    LessonPosition,
    NotesIssuePayload,
    TechniqueStepPayload,
)
from app.services.sudoku.lessons.store import load_pool


def _stored_positions() -> list[LessonPosition]:
    positions: list[LessonPosition] = []
    for technique in LESSON_TECHNIQUES:
        positions.extend(load_pool(technique))
    return positions


@pytest.mark.parametrize("position", _stored_positions(), ids=lambda position: position.id)
def test_stored_lesson_matches_live_coach(position: LessonPosition) -> None:
    if position.technique == PENCIL_LESSON:
        assert position.step is None
        issue = find_next_notes_issue(position.grid, position.notes)
        assert issue is not None
        assert NotesIssuePayload.from_issue(issue) == position.notes_issue
        return
    assert position.notes_issue is None
    located = locate_next_technique_step(position.grid, position.notes)
    assert located is not None
    assert TechniqueStepPayload.from_step(located.step) == position.step
