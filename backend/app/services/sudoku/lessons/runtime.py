from dataclasses import dataclass

from app.services.sudoku.candidates import initial_candidates
from app.services.sudoku.coach_step import candidates_after_step
from app.services.sudoku.grid import (
    EMPTY_CELL,
    GRID_SIDE,
    box_cell_indices,
    col_cell_indices,
    parse_grid,
    row_cell_indices,
    row_col,
)
from app.services.sudoku.lessons.models import (
    PENCIL_LESSON,
    LessonPosition,
    NotesIssuePayload,
    TechniqueStepPayload,
)
from app.services.sudoku.lessons.role import LessonRole
from app.services.sudoku.lessons.store import load_pool, position_by_id
from app.services.sudoku.technique import EASY_TECHNIQUES, Technique
from app.services.sudoku.technique_steps import TechniqueStep, outside_digit_cells


@dataclass(frozen=True)
class LessonRuntime:
    role: LessonRole
    has_practice: bool
    objective_met: bool
    step: TechniqueStepPayload | None
    notes_issue: NotesIssuePayload | None


def lesson_runtime(
    technique: str,
    position_id: str,
    grid: str,
    notes: dict[str, list[int]],
) -> LessonRuntime:
    positions = load_pool(technique)
    position = position_by_id(technique, position_id)
    return LessonRuntime(
        role=position.role,
        has_practice=any(item.role == LessonRole.practice for item in positions),
        objective_met=lesson_objective_met(position, grid, notes),
        step=position.step,
        notes_issue=position.notes_issue,
    )


def lesson_objective_met(
    position: LessonPosition,
    grid: str,
    notes: dict[str, list[int]],
) -> bool:
    values = parse_grid(grid)
    if position.technique == PENCIL_LESSON:
        return _pencil_objective_met(position, notes)
    step = _stored_step(position)
    if step.technique == Technique.NAKED_SINGLE:
        return any(values[index] == digit for index, digit in _naked_single_lesson_moves(position))
    if step.technique in EASY_TECHNIQUES:
        return values[step.focus_cells[0]] == step.digit_value
    if step.technique == Technique.POINTING_PAIR:
        intended = _pointing_pair_lesson_elims(position, step)
    else:
        intended = _elimination_targets(position, step)
    return _eliminations_applied(values, notes, intended)


def _stored_step(position: LessonPosition) -> TechniqueStep:
    payload = position.step
    if payload is None:
        raise ValueError(f"{position.id}: lesson missing step")
    return payload.to_step()


def _pencil_objective_met(position: LessonPosition, notes: dict[str, list[int]]) -> bool:
    issue = position.notes_issue
    if issue is None:
        raise ValueError(f"{position.id}: pencil lesson missing notes_issue")
    required = set(issue.digits)
    actual = set(notes.get(str(issue.cell_index), []))
    return required <= actual


def _elimination_targets(position: LessonPosition, step: TechniqueStep) -> dict[int, set[int]]:
    start_values = parse_grid(position.grid)
    before = initial_candidates(start_values)
    after = candidates_after_step(step, start_values, before)
    intended = {
        index: before[index] - after[index]
        for index, value in enumerate(start_values)
        if value == EMPTY_CELL and before[index] != after[index]
    }
    if not intended:
        raise ValueError(f"{position.id}: elimination step has no candidate changes")
    return intended


def _eliminations_applied(
    values: list[int],
    notes: dict[str, list[int]],
    intended: dict[int, set[int]],
) -> bool:
    for index, removed in intended.items():
        placed = values[index]
        if placed != EMPTY_CELL:
            if placed in removed:
                return False
            continue
        if set(notes.get(str(index), [])) & removed:
            return False
    return True


def _line_of_aligned_cells(focus_cells: tuple[int, ...]) -> list[int]:
    rows = {row_col(index)[0] for index in focus_cells}
    cols = {row_col(index)[1] for index in focus_cells}
    if len(rows) == 1:
        return row_cell_indices(next(iter(rows)))
    if len(cols) == 1:
        return col_cell_indices(next(iter(cols)))
    raise ValueError("pointing pair focus cells are not on one line")


def _notes_as_candidates(position: LessonPosition) -> list[set[int]]:
    start = parse_grid(position.grid)
    candidates: list[set[int]] = [set() for _ in start]
    for key, digits in position.notes.items():
        index = int(key)
        if start[index] != EMPTY_CELL:
            raise ValueError(f"{position.id}: notes on filled cell {index}")
        candidates[index] = set(digits)
    return candidates


def _pointing_pair_lesson_elims(
    position: LessonPosition,
    step: TechniqueStep,
) -> dict[int, set[int]]:
    if step.house_index is None:
        raise ValueError(f"{position.id}: pointing pair missing house_index")
    values = parse_grid(position.grid)
    candidates = _notes_as_candidates(position)
    box_indices = set(box_cell_indices(step.house_index))
    line = _line_of_aligned_cells(step.focus_cells)
    intended: dict[int, set[int]] = {}
    for digit in range(1, GRID_SIDE + 1):
        matching = [
            index
            for index in box_indices
            if values[index] == EMPTY_CELL and digit in candidates[index]
        ]
        if len(matching) < 2:
            continue
        if not set(matching) <= set(line):
            continue
        for index in outside_digit_cells(values, candidates, line, box_indices, digit):
            intended.setdefault(index, set()).add(digit)
    if not intended:
        raise ValueError(f"{position.id}: pointing pair lesson has no line eliminations")
    return intended


def _naked_single_lesson_moves(position: LessonPosition) -> list[tuple[int, int]]:
    start = parse_grid(position.grid)
    solution = parse_grid(position.solution)
    moves: list[tuple[int, int]] = []
    for index, start_value in enumerate(start):
        if start_value != EMPTY_CELL:
            continue
        notes = position.notes.get(str(index), [])
        if len(notes) != 1:
            continue
        digit = notes[0]
        if digit != solution[index]:
            raise ValueError(
                f"{position.id}: singleton note {digit} at {index} "
                f"does not match solution {solution[index]}"
            )
        moves.append((index, digit))
    if not moves:
        raise ValueError(f"{position.id}: no naked-single target cells")
    return moves
