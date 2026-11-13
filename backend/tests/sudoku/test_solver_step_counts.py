from typing import NamedTuple

import pytest

from app.services.sudoku.technique_solver import (
    ALL_TECHNIQUES,
    EASY_TECHNIQUES,
    MEDIUM_TECHNIQUES,
    Technique,
    solve_with_techniques,
)
from tests.fixtures import KNOWN_PUZZLE
from tests.sudoku.test_technique_solver import (
    HARD_XY_WING_PUZZLE,
    MEDIUM_PUZZLE,
    SHALLOW_MEDIUM_PUZZLE,
    SINGLES_ONLY_PUZZLE,
)

_PUZZLES = {
    "known": KNOWN_PUZZLE,
    "singles": SINGLES_ONLY_PUZZLE,
    "medium": MEDIUM_PUZZLE,
    "shallow": SHALLOW_MEDIUM_PUZZLE,
    "xy": HARD_XY_WING_PUZZLE,
}

_ALLOWED = {
    "easy": EASY_TECHNIQUES,
    "medium": MEDIUM_TECHNIQUES,
    "all": ALL_TECHNIQUES,
}

_XY_ALL_TECHNIQUES = frozenset(
    {
        Technique.NAKED_SINGLE,
        Technique.HIDDEN_SINGLE,
        Technique.NAKED_PAIR,
        Technique.HIDDEN_PAIR,
        Technique.POINTING_PAIR,
        Technique.BOX_LINE_REDUCTION,
        Technique.SWORDFISH,
        Technique.XY_WING,
    }
)


class StepCountCase(NamedTuple):
    puzzle_name: str
    allowed_name: str
    solved: bool
    hardest: Technique
    easy_steps: int
    medium_steps: int
    hard_steps: int


_CASES = [
    StepCountCase("known", "easy", True, Technique.NAKED_SINGLE, 1, 0, 0),
    StepCountCase("known", "medium", True, Technique.NAKED_SINGLE, 1, 0, 0),
    StepCountCase("known", "all", True, Technique.NAKED_SINGLE, 1, 0, 0),
    StepCountCase("singles", "easy", True, Technique.NAKED_SINGLE, 7, 0, 0),
    StepCountCase("singles", "medium", True, Technique.NAKED_SINGLE, 7, 0, 0),
    StepCountCase("singles", "all", True, Technique.NAKED_SINGLE, 7, 0, 0),
    StepCountCase("medium", "easy", False, Technique.HIDDEN_SINGLE, 3, 0, 0),
    StepCountCase("medium", "medium", True, Technique.BOX_LINE_REDUCTION, 13, 4, 0),
    StepCountCase("medium", "all", True, Technique.BOX_LINE_REDUCTION, 13, 4, 0),
    StepCountCase("shallow", "easy", False, Technique.HIDDEN_SINGLE, 2, 0, 0),
    StepCountCase("shallow", "medium", True, Technique.NAKED_PAIR, 8, 1, 0),
    StepCountCase("shallow", "all", True, Technique.NAKED_PAIR, 8, 1, 0),
    StepCountCase("xy", "easy", False, Technique.HIDDEN_SINGLE, 3, 0, 0),
    StepCountCase("xy", "medium", False, Technique.BOX_LINE_REDUCTION, 4, 5, 0),
    StepCountCase("xy", "all", True, Technique.XY_WING, 10, 5, 2),
]


@pytest.mark.parametrize(
    "case",
    _CASES,
    ids=[f"{case.puzzle_name}-{case.allowed_name}" for case in _CASES],
)
def test_solve_with_techniques_step_counts(case: StepCountCase) -> None:
    result = solve_with_techniques(_PUZZLES[case.puzzle_name], _ALLOWED[case.allowed_name])
    assert result.solved is case.solved
    assert result.hardest_technique == case.hardest
    assert result.easy_step_count == case.easy_steps
    assert result.medium_step_count == case.medium_steps
    assert result.hard_step_count == case.hard_steps
    if case.puzzle_name == "xy" and case.allowed_name == "all":
        assert result.techniques_used == _XY_ALL_TECHNIQUES
