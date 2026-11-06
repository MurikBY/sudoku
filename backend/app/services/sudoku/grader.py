from app.services.sudoku.technique_solver import Technique, TechniqueSolveResult

# SE-inspired technique ceiling weights (tunable).
TECHNIQUE_GRADE_WEIGHTS: dict[Technique, float] = {
    Technique.NAKED_SINGLE: 1.0,
    Technique.HIDDEN_SINGLE: 1.15,
    Technique.NAKED_PAIR: 1.5,
    Technique.HIDDEN_PAIR: 1.7,
    Technique.POINTING_PAIR: 1.9,
    Technique.BOX_LINE_REDUCTION: 1.9,
    Technique.X_WING: 2.5,
    Technique.SWORDFISH: 3.2,
    Technique.XY_WING: 3.4,
    Technique.XYZ_WING: 3.6,
}

# Path-aware grade = ceiling + hard/medium volume + length tail.
HARD_STEP_GRADE_BONUS = 0.35
MEDIUM_STEP_GRADE_BONUS = 0.08
TOTAL_STEP_GRADE_BONUS = 0.5
TOTAL_STEP_OFFSET = 15
TOTAL_STEP_SCALE = 40.0

# Label bands (calibrated).
# Medium: pointing ceiling alone (1.9) stays below; one medium step clears (~1.98).
# Hard: shallow 1-hard-step puzzles stay below HARD.
GRADE_MEDIUM_MIN = 1.95
GRADE_HARD_MIN = 4.0


def max_technique_weight(result: TechniqueSolveResult) -> float:
    if result.hardest_technique is None:
        return TECHNIQUE_GRADE_WEIGHTS[Technique.NAKED_SINGLE]
    return TECHNIQUE_GRADE_WEIGHTS[result.hardest_technique]


def grade_from_result(result: TechniqueSolveResult) -> float:
    length_tail = max(0, result.total_step_count - TOTAL_STEP_OFFSET) / TOTAL_STEP_SCALE
    return (
        max_technique_weight(result)
        + HARD_STEP_GRADE_BONUS * result.hard_step_count
        + MEDIUM_STEP_GRADE_BONUS * result.medium_step_count
        + TOTAL_STEP_GRADE_BONUS * length_tail
    )
