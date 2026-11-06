from app.services.sudoku.grader import (
    GRADE_HARD_MIN,
    GRADE_MEDIUM_MIN,
    grade_from_result,
    max_technique_weight,
)
from app.services.sudoku.technique_solver import Technique, TechniqueSolveResult


def test_max_technique_weight_uses_hardest():
    result = TechniqueSolveResult(True, Technique.XY_WING, frozenset({Technique.XY_WING}))
    assert max_technique_weight(result) == 3.4


def test_grade_adds_path_bonuses():
    result = TechniqueSolveResult(
        True,
        Technique.XY_WING,
        frozenset({Technique.XY_WING}),
        easy_step_count=10,
        medium_step_count=1,
        hard_step_count=1,
    )
    # 3.4 + 0.35*1 + 0.08*1 + 0.5*max(0,12-15)/40 = 3.83
    assert abs(grade_from_result(result) - 3.83) < 1e-9
    assert grade_from_result(result) < GRADE_HARD_MIN


def test_single_medium_technique_stays_below_medium_band():
    result = TechniqueSolveResult(
        True,
        Technique.POINTING_PAIR,
        frozenset({Technique.POINTING_PAIR}),
        medium_step_count=0,
        easy_step_count=8,
    )
    # pointing ceiling alone = 1.9
    assert grade_from_result(result) < GRADE_MEDIUM_MIN


def test_medium_path_volume_clears_medium_band():
    result = TechniqueSolveResult(
        True,
        Technique.POINTING_PAIR,
        frozenset({Technique.POINTING_PAIR}),
        medium_step_count=1,
        easy_step_count=8,
    )
    # 1.9 + 0.08 = 1.98
    assert grade_from_result(result) >= GRADE_MEDIUM_MIN


def test_dense_hard_path_clears_hard_band():
    result = TechniqueSolveResult(
        True,
        Technique.XY_WING,
        frozenset({Technique.XY_WING}),
        easy_step_count=10,
        medium_step_count=5,
        hard_step_count=2,
    )
    assert grade_from_result(result) >= GRADE_HARD_MIN
