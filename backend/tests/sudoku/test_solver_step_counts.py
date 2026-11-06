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

_ROWS = [
    ("known", "easy", True, Technique.NAKED_SINGLE, 1, 0, 0),
    ("known", "medium", True, Technique.NAKED_SINGLE, 1, 0, 0),
    ("known", "all", True, Technique.NAKED_SINGLE, 1, 0, 0),
    ("singles", "easy", True, Technique.NAKED_SINGLE, 7, 0, 0),
    ("singles", "medium", True, Technique.NAKED_SINGLE, 7, 0, 0),
    ("singles", "all", True, Technique.NAKED_SINGLE, 7, 0, 0),
    ("medium", "easy", False, Technique.HIDDEN_SINGLE, 3, 0, 0),
    ("medium", "medium", True, Technique.BOX_LINE_REDUCTION, 13, 4, 0),
    ("medium", "all", True, Technique.BOX_LINE_REDUCTION, 13, 4, 0),
    ("shallow", "easy", False, Technique.HIDDEN_SINGLE, 2, 0, 0),
    ("shallow", "medium", True, Technique.NAKED_PAIR, 8, 1, 0),
    ("shallow", "all", True, Technique.NAKED_PAIR, 8, 1, 0),
    ("xy", "easy", False, Technique.HIDDEN_SINGLE, 3, 0, 0),
    ("xy", "medium", False, Technique.BOX_LINE_REDUCTION, 4, 5, 0),
    ("xy", "all", True, Technique.XY_WING, 10, 5, 2),
]


@pytest.mark.parametrize(
    (
        "puzzle_name",
        "allowed_name",
        "solved",
        "hardest",
        "easy_steps",
        "medium_steps",
        "hard_steps",
    ),
    _ROWS,
    ids=[f"{puzzle_name}-{allowed_name}" for puzzle_name, allowed_name, *_rest in _ROWS],
)
def test_solve_with_techniques_step_counts(
    puzzle_name: str,
    allowed_name: str,
    solved: bool,
    hardest: Technique,
    easy_steps: int,
    medium_steps: int,
    hard_steps: int,
) -> None:
    result = solve_with_techniques(_PUZZLES[puzzle_name], _ALLOWED[allowed_name])
    assert result.solved is solved
    assert result.hardest_technique == hardest
    assert result.easy_step_count == easy_steps
    assert result.medium_step_count == medium_steps
    assert result.hard_step_count == hard_steps
    if puzzle_name == "xy" and allowed_name == "all":
        assert result.techniques_used == _XY_ALL_TECHNIQUES
