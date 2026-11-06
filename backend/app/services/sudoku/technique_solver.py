from dataclasses import dataclass

from app.services.sudoku.candidates import (
    has_candidate_contradiction,
    initial_candidates,
    is_solved,
    place_digit,
)
from app.services.sudoku.grid import (
    EMPTY_CELL,
    box_cell_indices,
    box_index,
    col_cell_indices,
    parse_grid,
    row_cell_indices,
    row_col,
)
from app.services.sudoku.technique import (
    ALL_TECHNIQUES,
    EASY_TECHNIQUES,
    HARD_TECHNIQUES,
    MEDIUM_TECHNIQUES,
    TECHNIQUE_ORDER,
    Technique,
    hardest_of,
)
from app.services.sudoku.technique_registry import apply_scan
from app.services.sudoku.technique_steps import iter_hidden_singles, iter_naked_singles

__all__ = [
    "ALL_TECHNIQUES",
    "EASY_TECHNIQUES",
    "FORCED_NAKED_SINGLE_EMPTY_LIMIT",
    "HARD_TECHNIQUES",
    "MEDIUM_TECHNIQUES",
    "OBVIOUS_NAKED_SINGLE_HOUSE_EMPTY_MAX",
    "TECHNIQUE_ORDER",
    "Technique",
    "TechniqueSolveResult",
    "easy_path_forces_hard_naked_single",
    "position_forces_hard_naked_single",
    "solve_with_techniques",
]


@dataclass(frozen=True)
class TechniqueSolveResult:
    solved: bool
    hardest_technique: Technique | None
    techniques_used: frozenset[Technique]
    easy_step_count: int = 0
    medium_step_count: int = 0
    hard_step_count: int = 0

    @property
    def total_step_count(self) -> int:
        return self.easy_step_count + self.medium_step_count + self.hard_step_count


def solve_with_techniques(
    grid: str,
    allowed_techniques: frozenset[Technique],
) -> TechniqueSolveResult:
    values = parse_grid(grid)
    candidates = initial_candidates(values)
    techniques_used: set[Technique] = set()
    hardest_technique: Technique | None = None
    easy_step_count = 0
    medium_step_count = 0
    hard_step_count = 0

    while not is_solved(values):
        if has_candidate_contradiction(values, candidates):
            return TechniqueSolveResult(
                False,
                hardest_technique,
                frozenset(techniques_used),
                easy_step_count,
                medium_step_count,
                hard_step_count,
            )

        made_progress = False
        for technique in TECHNIQUE_ORDER:
            if technique not in allowed_techniques:
                continue
            if apply_scan(technique, values, candidates):
                techniques_used.add(technique)
                hardest_technique = hardest_of(hardest_technique, technique)
                if technique in EASY_TECHNIQUES:
                    easy_step_count += 1
                elif technique in MEDIUM_TECHNIQUES:
                    medium_step_count += 1
                else:
                    hard_step_count += 1
                made_progress = True
                break

        if not made_progress:
            return TechniqueSolveResult(
                False,
                hardest_technique,
                frozenset(techniques_used),
                easy_step_count,
                medium_step_count,
                hard_step_count,
            )

    return TechniqueSolveResult(
        True,
        hardest_technique,
        frozenset(techniques_used),
        easy_step_count,
        medium_step_count,
        hard_step_count,
    )


# A naked single in a row, column, or box with this many empties is visible.
OBVIOUS_NAKED_SINGLE_HOUSE_EMPTY_MAX = 2
# Above this many empties, a forced hard naked single is too much cell-hunting for easy.
FORCED_NAKED_SINGLE_EMPTY_LIMIT = 24


def easy_path_forces_hard_naked_single(puzzle: str) -> bool:
    # Place hidden singles and obvious naked singles first. The technique solver
    # clears every naked single before any hidden single, which is not the move
    # the player is forced to find.
    values = parse_grid(puzzle)
    candidates = initial_candidates(values)
    while not is_solved(values):
        if position_forces_hard_naked_single(values, candidates):
            return True
        if not _place_next_easy_single(values, candidates):
            raise RuntimeError("easy puzzle cannot place a single")
    return False


def position_forces_hard_naked_single(
    values: list[int],
    candidates: list[set[int]],
) -> bool:
    if first_hidden_single(values, candidates) is not None:
        return False
    naked_singles = naked_single_placements(values, candidates)
    if any(naked_single_is_obvious(values, index) for index, _digit in naked_singles):
        return False
    if not naked_singles:
        return False
    empty_count = sum(value == EMPTY_CELL for value in values)
    return empty_count > FORCED_NAKED_SINGLE_EMPTY_LIMIT


def _place_next_easy_single(
    values: list[int],
    candidates: list[set[int]],
) -> bool:
    hidden_single = first_hidden_single(values, candidates)
    if hidden_single is not None:
        index, digit = hidden_single
        place_digit(values, candidates, index, digit)
        return True
    naked_singles = naked_single_placements(values, candidates)
    obvious = [
        placement for placement in naked_singles if naked_single_is_obvious(values, placement[0])
    ]
    if obvious:
        index, digit = obvious[0]
        place_digit(values, candidates, index, digit)
        return True
    if not naked_singles:
        return False
    index, digit = naked_singles[0]
    place_digit(values, candidates, index, digit)
    return True


def first_hidden_single(
    values: list[int],
    candidates: list[set[int]],
) -> tuple[int, int] | None:
    step = next(iter_hidden_singles(values, candidates), None)
    if step is None:
        return None
    return step.focus_cells[0], step.digit_value


def naked_single_placements(
    values: list[int],
    candidates: list[set[int]],
) -> list[tuple[int, int]]:
    placements: list[tuple[int, int]] = []
    for step in iter_naked_singles(values, candidates):
        placements.append((step.focus_cells[0], step.digit_value))
    return placements


def naked_single_is_obvious(values: list[int], index: int) -> bool:
    row, col = row_col(index)
    houses = (
        row_cell_indices(row),
        col_cell_indices(col),
        box_cell_indices(box_index(row, col)),
    )
    for house in houses:
        empty_count = sum(values[cell] == EMPTY_CELL for cell in house)
        if empty_count <= OBVIOUS_NAKED_SINGLE_HOUSE_EMPTY_MAX:
            return True
    return False
