import random
from dataclasses import replace

import pytest

from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.grader import GRADE_HARD_MIN, grade_from_result
from app.services.sudoku.puzzle import GENERATION_PROFILES, generate_puzzle
from app.services.sudoku.rater import (
    matches_target_difficulty,
    rate_difficulty,
    rate_puzzle,
)
from app.services.sudoku.solver import count_solutions, solve
from app.services.sudoku.technique_solver import easy_path_forces_hard_naked_single
from tests.fixtures import KNOWN_PUZZLE, SHALLOW_HARD_PUZZLE


def test_generate_easy_puzzle_smoke():
    generated = generate_puzzle(Difficulty.easy, rng=random.Random(7), max_attempts=10)
    assert generated.difficulty == Difficulty.easy
    assert rate_difficulty(generated.puzzle) == Difficulty.easy
    assert generated.givens_count >= 30
    assert count_solutions(generated.puzzle, limit=2) == 1
    assert solve(generated.puzzle) == generated.solution
    assert easy_path_forces_hard_naked_single(generated.puzzle) is False


def test_generate_medium_matches_grade_band():
    generated = generate_puzzle(
        Difficulty.medium,
        rng=random.Random(7),
        max_attempts=80,
        max_generate_seconds=180,
    )
    rating = rate_puzzle(generated.puzzle)
    assert matches_target_difficulty(rating, Difficulty.medium)
    assert rating.hard_step_count == 0
    assert generated.givens_count >= 24
    assert generated.givens_count <= 30


def test_generate_hard_matches_grade_band():
    generated = generate_puzzle(Difficulty.hard, rng=random.Random(1), max_attempts=80)
    rating = rate_puzzle(generated.puzzle)
    assert matches_target_difficulty(rating, Difficulty.hard)
    assert grade_from_result(rating) >= GRADE_HARD_MIN
    assert generated.givens_count >= 18


def test_shallow_hard_is_rejected_not_medium():
    rating = rate_puzzle(SHALLOW_HARD_PUZZLE)
    assert rating.hard_step_count == 1
    assert grade_from_result(rating) < GRADE_HARD_MIN
    assert not matches_target_difficulty(rating, Difficulty.hard)
    assert not matches_target_difficulty(rating, Difficulty.medium)
    assert not matches_target_difficulty(rating, Difficulty.easy)
    with pytest.raises(ValueError, match="hard grade band"):
        rate_difficulty(SHALLOW_HARD_PUZZLE)


def test_known_puzzle_has_unique_solution():
    assert count_solutions(KNOWN_PUZZLE, limit=2) == 1
    assert solve(KNOWN_PUZZLE) is not None


def test_generate_puzzle_rejects_invalid_difficulty():
    with pytest.raises(ValueError, match="invalid difficulty"):
        generate_puzzle("expert")  # type: ignore[arg-type]


def _limit_hard_to_one_dig(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(
        GENERATION_PROFILES,
        Difficulty.hard,
        replace(GENERATION_PROFILES[Difficulty.hard], digs_per_grid=1),
    )


def test_generate_puzzle_raises_after_max_attempts(monkeypatch):
    _limit_hard_to_one_dig(monkeypatch)
    monkeypatch.setattr(
        "app.services.sudoku.puzzle.matches_target_difficulty",
        lambda _rating, _difficulty: False,
    )
    with pytest.raises(RuntimeError, match="failed to generate"):
        generate_puzzle(Difficulty.hard, rng=random.Random(1), max_attempts=1)


def test_generate_puzzle_raises_after_time_budget(monkeypatch):
    _limit_hard_to_one_dig(monkeypatch)
    monkeypatch.setattr(
        "app.services.sudoku.puzzle.matches_target_difficulty",
        lambda _rating, _difficulty: False,
    )
    with pytest.raises(RuntimeError, match="failed to generate"):
        generate_puzzle(
            Difficulty.hard,
            rng=random.Random(1),
            max_attempts=1000,
            max_generate_seconds=0.01,
        )
