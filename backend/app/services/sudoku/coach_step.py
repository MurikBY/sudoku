from dataclasses import dataclass
from enum import StrEnum

from app.services.sudoku.candidates import has_candidate_contradiction, initial_candidates
from app.services.sudoku.grid import (
    CELL_COUNT,
    EMPTY_CELL,
    HouseKind,
    box_cell_indices,
    box_index,
    col_cell_indices,
    parse_grid,
    row_cell_indices,
    row_col,
)
from app.services.sudoku.technique_registry import candidates_after, first_step_of
from app.services.sudoku.technique_solver import EASY_TECHNIQUES, TECHNIQUE_ORDER, Technique
from app.services.sudoku.technique_steps import TechniqueStep, outside_digit_cells

__all__ = [
    "HouseKind",
    "LocatedTechniqueStep",
    "NotesIssue",
    "NotesIssueKind",
    "TechniqueStep",
    "candidate_layer_from_notes",
    "candidates_after_medium_elims",
    "candidates_after_step",
    "find_next_notes_issue",
    "find_next_technique_step",
    "locate_next_technique_step",
    "outside_digit_cells",
]


class NotesIssueKind(StrEnum):
    illegal = "illegal"
    empty = "empty"
    incomplete = "incomplete"


@dataclass(frozen=True)
class LocatedTechniqueStep:
    step: TechniqueStep
    candidates: list[set[int]]


@dataclass(frozen=True)
class NotesIssue:
    kind: NotesIssueKind
    cell_index: int
    digit: int | None = None
    digits: tuple[int, ...] = ()
    house: HouseKind | None = None
    house_index: int | None = None
    outline_cells: tuple[int, ...] = ()


def find_next_technique_step(
    grid: str,
    notes: dict[str, list[int]] | None = None,
) -> TechniqueStep | None:
    located = locate_next_technique_step(grid, notes)
    if located is None:
        return None
    return located.step


def locate_next_technique_step(
    grid: str,
    notes: dict[str, list[int]] | None = None,
) -> LocatedTechniqueStep | None:
    board_notes = notes if notes is not None else {}
    values = parse_grid(grid)
    candidates = initial_candidates(values)
    if has_candidate_contradiction(values, candidates):
        return None
    while True:
        step = _find_first_step(values, candidates)
        if step is None:
            return None
        after = candidates_after_step(step, values, candidates)
        if _step_reflected_in_notes(step, values, candidates, after, board_notes):
            candidates = after
            continue
        return LocatedTechniqueStep(
            step=step,
            candidates=[set(cell_candidates) for cell_candidates in candidates],
        )


def _find_first_step(
    values: list[int],
    candidates: list[set[int]],
    *,
    skip_easy: bool = False,
) -> TechniqueStep | None:
    for technique in TECHNIQUE_ORDER:
        if skip_easy and technique in EASY_TECHNIQUES:
            continue
        step = first_step_of(technique, values, candidates)
        if step is not None:
            return step
    return None


def find_next_notes_issue(
    grid: str,
    notes: dict[str, list[int]] | None = None,
) -> NotesIssue | None:
    board_notes = notes if notes is not None else {}
    values = parse_grid(grid)
    basic = initial_candidates(values)
    notes_layer = candidate_layer_from_notes(values, basic, board_notes)
    required = candidates_after_medium_elims(
        values,
        notes_layer,
    )
    illegal = _first_illegal_note(values, basic, board_notes)
    if illegal is not None:
        return illegal
    empty = _first_empty_notes_cell(values, required, board_notes)
    if empty is not None:
        return empty
    pair_focus = _first_pair_focus_incomplete(grid, board_notes)
    if pair_focus is not None:
        return pair_focus
    return _first_incomplete_notes_cell(values, required, board_notes)


def candidate_layer_from_notes(
    values: list[int],
    basic: list[set[int]],
    notes: dict[str, list[int]],
) -> list[set[int]]:
    layer = [set(cell_candidates) for cell_candidates in basic]
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        user_notes = set(notes.get(str(index), []))
        if not user_notes:
            continue
        layer[index] = user_notes & basic[index]
    return layer


def candidates_after_medium_elims(
    values: list[int],
    candidates: list[set[int]],
) -> list[set[int]]:
    current = [set(cell_candidates) for cell_candidates in candidates]
    for _ in range(CELL_COUNT):
        step = _find_first_step(values, current, skip_easy=True)
        if step is None:
            return current
        after = candidates_after_step(step, values, current)
        if after == current:
            return current
        current = after
    return current


def _first_illegal_note(
    values: list[int],
    basic: list[set[int]],
    notes: dict[str, list[int]],
) -> NotesIssue | None:
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        extras = set(notes.get(str(index), [])) - basic[index]
        if not extras:
            continue
        digit = min(extras)
        house, house_index = _house_containing_digit(values, index, digit)
        return NotesIssue(
            kind=NotesIssueKind.illegal,
            cell_index=index,
            digit=digit,
            digits=(digit,),
            house=house,
            house_index=house_index,
            outline_cells=_house_cells(house, house_index),
        )
    return None


def _first_empty_notes_cell(
    values: list[int],
    required: list[set[int]],
    notes: dict[str, list[int]],
) -> NotesIssue | None:
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        if notes.get(str(index), []):
            continue
        return NotesIssue(
            kind=NotesIssueKind.empty,
            cell_index=index,
            digits=tuple(sorted(required[index])),
            outline_cells=(index,),
        )
    return None


def _first_incomplete_notes_cell(
    values: list[int],
    required: list[set[int]],
    notes: dict[str, list[int]],
) -> NotesIssue | None:
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        user_notes = set(notes.get(str(index), []))
        if not user_notes:
            continue
        missing = required[index] - user_notes
        if not missing:
            continue
        return NotesIssue(
            kind=NotesIssueKind.incomplete,
            cell_index=index,
            digits=tuple(sorted(missing)),
            outline_cells=(index,),
        )
    return None


def _first_pair_focus_incomplete(
    grid: str,
    notes: dict[str, list[int]],
) -> NotesIssue | None:
    located = locate_next_technique_step(grid, notes)
    if located is None:
        return None
    step = located.step
    if step.technique not in {Technique.NAKED_PAIR, Technique.HIDDEN_PAIR}:
        return None
    pair = set(step.digits)
    for index in step.focus_cells:
        user_notes = set(notes.get(str(index), []))
        if not user_notes:
            continue
        missing = pair - user_notes
        if not missing:
            continue
        return NotesIssue(
            kind=NotesIssueKind.incomplete,
            cell_index=index,
            digits=tuple(sorted(missing)),
            outline_cells=(index,),
        )
    return None


def _house_containing_digit(
    values: list[int],
    cell: int,
    digit: int,
) -> tuple[HouseKind, int]:
    row, col = row_col(cell)
    if any(values[index] == digit for index in row_cell_indices(row)):
        return HouseKind.row, row
    if any(values[index] == digit for index in col_cell_indices(col)):
        return HouseKind.col, col
    box = box_index(row, col)
    if any(values[index] == digit for index in box_cell_indices(box)):
        return HouseKind.box, box
    raise RuntimeError("illegal note has no proving house")


def _house_cells(house: HouseKind, house_index: int) -> tuple[int, ...]:
    if house == HouseKind.row:
        return tuple(row_cell_indices(house_index))
    if house == HouseKind.col:
        return tuple(col_cell_indices(house_index))
    return tuple(box_cell_indices(house_index))


def _step_reflected_in_notes(
    step: TechniqueStep,
    values: list[int],
    before: list[set[int]],
    after: list[set[int]],
    notes: dict[str, list[int]],
) -> bool:
    if step.technique in {Technique.NAKED_PAIR, Technique.HIDDEN_PAIR}:
        pair = set(step.digits)
        for index in step.focus_cells:
            user_notes = set(notes.get(str(index), []))
            if not user_notes:
                continue
            if not pair <= user_notes:
                return False
    changed_indices = [
        index
        for index, value in enumerate(values)
        if value == EMPTY_CELL and before[index] != after[index]
    ]
    if not changed_indices:
        return False
    saw_notes = False
    for index in changed_indices:
        user_notes = set(notes.get(str(index), []))
        if not user_notes:
            continue
        saw_notes = True
        if user_notes & (before[index] - after[index]):
            return False
    return saw_notes


def candidates_after_step(
    step: TechniqueStep,
    values: list[int],
    candidates: list[set[int]],
) -> list[set[int]]:
    return candidates_after(step, values, candidates)
