from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.grader import (
    GRADE_HARD_MIN,
    GRADE_MEDIUM_MIN,
    grade_from_result,
)
from app.services.sudoku.technique_solver import (
    ALL_TECHNIQUES,
    EASY_TECHNIQUES,
    HARD_TECHNIQUES,
    MEDIUM_TECHNIQUES,
    TechniqueSolveResult,
    solve_with_techniques,
)

_MEDIUM_ONLY_TECHNIQUES = MEDIUM_TECHNIQUES - EASY_TECHNIQUES


def rate_puzzle(puzzle: str) -> TechniqueSolveResult:
    result = solve_with_techniques(puzzle, ALL_TECHNIQUES)
    if not result.solved:
        raise ValueError("puzzle is not solvable with supported human techniques")
    return result


def rate_difficulty(puzzle: str) -> Difficulty:
    return difficulty_from_result(rate_puzzle(puzzle))


def uses_hard_technique(result: TechniqueSolveResult) -> bool:
    return result.hardest_technique in HARD_TECHNIQUES


def uses_medium_technique(result: TechniqueSolveResult) -> bool:
    if result.medium_step_count > 0:
        return True
    return result.hardest_technique in _MEDIUM_ONLY_TECHNIQUES


def difficulty_from_result(result: TechniqueSolveResult) -> Difficulty:
    grade = grade_from_result(result)
    if uses_hard_technique(result):
        if grade >= GRADE_HARD_MIN:
            return Difficulty.hard
        raise ValueError("hard-technique puzzle below hard grade band")
    if uses_medium_technique(result):
        if grade >= GRADE_MEDIUM_MIN:
            return Difficulty.medium
        raise ValueError("medium-technique puzzle below medium grade band")
    return Difficulty.easy


def matches_target_difficulty(
    result: TechniqueSolveResult,
    difficulty: Difficulty,
) -> bool:
    grade = grade_from_result(result)
    has_hard = uses_hard_technique(result)
    has_medium = uses_medium_technique(result)
    if difficulty == Difficulty.hard:
        return has_hard and grade >= GRADE_HARD_MIN
    if difficulty == Difficulty.medium:
        return (not has_hard) and has_medium and grade >= GRADE_MEDIUM_MIN
    return (not has_hard) and (not has_medium)
