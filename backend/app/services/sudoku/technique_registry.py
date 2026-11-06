from collections.abc import Callable, Iterator
from dataclasses import dataclass

from app.services.sudoku.candidates import place_digit
from app.services.sudoku.technique import Technique
from app.services.sudoku.technique_steps import (
    TechniqueStep,
    eliminate_box_line,
    eliminate_hidden_pair,
    eliminate_locked_digit,
    eliminate_naked_pair,
    iter_box_line_reductions,
    iter_hidden_pairs,
    iter_hidden_singles,
    iter_naked_pairs,
    iter_naked_singles,
    iter_pointing_pairs,
    iter_swordfishes,
    iter_x_wings,
    iter_xy_wings,
    iter_xyz_wings,
)


@dataclass(frozen=True)
class TechniqueSpec:
    iterate: Callable[[list[int], list[set[int]]], Iterator[TechniqueStep]]
    eliminate: Callable[[TechniqueStep, list[int], list[set[int]]], None] | None


def _eliminate_hidden_pair(
    step: TechniqueStep,
    _values: list[int],
    candidates: list[set[int]],
) -> None:
    # eliminate_hidden_pair takes no values; every registry eliminator receives them.
    eliminate_hidden_pair(step, candidates)


TECHNIQUES: dict[Technique, TechniqueSpec] = {
    Technique.NAKED_SINGLE: TechniqueSpec(iter_naked_singles, None),
    Technique.HIDDEN_SINGLE: TechniqueSpec(iter_hidden_singles, None),
    Technique.NAKED_PAIR: TechniqueSpec(iter_naked_pairs, eliminate_naked_pair),
    Technique.HIDDEN_PAIR: TechniqueSpec(iter_hidden_pairs, _eliminate_hidden_pair),
    Technique.POINTING_PAIR: TechniqueSpec(iter_pointing_pairs, eliminate_locked_digit),
    Technique.BOX_LINE_REDUCTION: TechniqueSpec(iter_box_line_reductions, eliminate_box_line),
    Technique.X_WING: TechniqueSpec(iter_x_wings, eliminate_locked_digit),
    Technique.SWORDFISH: TechniqueSpec(iter_swordfishes, eliminate_locked_digit),
    Technique.XY_WING: TechniqueSpec(iter_xy_wings, eliminate_locked_digit),
    Technique.XYZ_WING: TechniqueSpec(iter_xyz_wings, eliminate_locked_digit),
}


def apply_scan(
    technique: Technique,
    values: list[int],
    candidates: list[set[int]],
) -> bool:
    spec = TECHNIQUES[technique]
    applied = False
    for step in spec.iterate(values, candidates):
        if spec.eliminate is None:
            place_digit(values, candidates, step.focus_cells[0], step.digit_value)
        else:
            spec.eliminate(step, values, candidates)
        applied = True
    return applied


def first_step_of(
    technique: Technique,
    values: list[int],
    candidates: list[set[int]],
) -> TechniqueStep | None:
    return next(TECHNIQUES[technique].iterate(values, candidates), None)


def candidates_after(
    step: TechniqueStep,
    values: list[int],
    candidates: list[set[int]],
) -> list[set[int]]:
    copied = [set(cell_candidates) for cell_candidates in candidates]
    eliminate = TECHNIQUES[step.technique].eliminate
    if eliminate is not None:
        eliminate(step, values, copied)
    return copied
