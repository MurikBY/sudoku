import json
from random import Random

import pytest
from pydantic import ValidationError

from app.models.enums import LessonRole
from app.schemas.game import TaughtLessonSnapshotResponse
from app.services.sudoku.coach_step import (
    NotesIssueKind,
    find_next_notes_issue,
    locate_next_technique_step,
)
from app.services.sudoku.grid import HouseKind, row_col
from app.services.sudoku.lessons.authoring import (
    assign_pool,
    iter_technique_snapshots,
    pencil_snapshot,
    symmetrize_lesson,
    validate_lesson_position,
)
from app.services.sudoku.lessons.models import (
    LESSON_POOL_SIZE,
    LESSON_TECHNIQUES,
    PENCIL_LESSON,
    LessonPosition,
    TechniqueStepPayload,
)
from app.services.sudoku.lessons.runtime import lesson_objective_met
from app.services.sudoku.lessons.store import load_pool, taught_position
from app.services.sudoku.solver import solve
from app.services.sudoku.technique_solver import Technique
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION

MEDIUM_PUZZLE = "270300590510000036000100820600000010000782059000000000080000000900043000060070000"


def test_walk_known_puzzle_starts_with_naked_single():
    snapshots = list(iter_technique_snapshots(KNOWN_PUZZLE, KNOWN_SOLUTION))
    assert snapshots
    assert snapshots[0].technique == Technique.NAKED_SINGLE.value
    validate_lesson_position(
        LessonPosition(
            id="known-naked-single",
            technique=snapshots[0].technique,
            role=LessonRole.taught,
            puzzle=snapshots[0].puzzle,
            solution=snapshots[0].solution,
            grid=snapshots[0].grid,
            notes=snapshots[0].notes,
            step=snapshots[0].step,
            notes_issue=None,
        ),
    )


def test_walk_medium_puzzle_hits_a_pair_technique():
    solution = solve(MEDIUM_PUZZLE)
    assert solution is not None
    techniques = {
        snapshot.technique for snapshot in iter_technique_snapshots(MEDIUM_PUZZLE, solution)
    }
    assert Technique.HIDDEN_PAIR.value in techniques or Technique.NAKED_PAIR.value in techniques


def test_pencil_snapshot_has_empty_notes_issue():
    solution = solve(MEDIUM_PUZZLE)
    assert solution is not None
    snapshot = pencil_snapshot(MEDIUM_PUZZLE, solution, MEDIUM_PUZZLE)
    assert snapshot.technique == PENCIL_LESSON
    issue = find_next_notes_issue(snapshot.grid, snapshot.notes)
    assert issue is not None
    assert issue.kind in {NotesIssueKind.empty, NotesIssueKind.incomplete}
    empty_cells = [index for index, digit in enumerate(snapshot.grid) if digit == "0"]
    assert str(issue.cell_index) not in snapshot.notes
    assert set(snapshot.notes) == {str(index) for index in empty_cells if index != issue.cell_index}
    validate_lesson_position(
        LessonPosition(
            id="pencil-check",
            technique=PENCIL_LESSON,
            role=LessonRole.taught,
            puzzle=snapshot.puzzle,
            solution=snapshot.solution,
            grid=snapshot.grid,
            notes=snapshot.notes,
            step=None,
            notes_issue=snapshot.notes_issue,
        ),
    )


def test_assign_pool_marks_clearest_as_taught():
    step = TechniqueStepPayload(
        technique=Technique.NAKED_SINGLE,
        outline_cells=[0],
        focus_cells=[0],
        elim_cells=[],
        digit=1,
        digits=[1],
        house=None,
        house_index=None,
    )
    snapshots = [
        LessonPosition(
            id="",
            technique=Technique.NAKED_SINGLE.value,
            role=LessonRole.practice,
            puzzle="0" * 81,
            solution="1" * 81,
            grid=("0" * empty) + ("1" * (81 - empty)),
            notes={},
            step=step,
            notes_issue=None,
        )
        for empty in range(LESSON_POOL_SIZE, 0, -1)
    ]
    pool = assign_pool(Technique.NAKED_SINGLE.value, snapshots)
    assert pool[0].role == "taught"
    assert pool[0].id == "naked_single-01"
    assert [position.role for position in pool[1:]] == ["practice"] * (LESSON_POOL_SIZE - 1)
    assert pool[0].grid.count("0") == 1


def test_roundtrip_json_keeps_the_technique():
    snapshot = next(iter_technique_snapshots(KNOWN_PUZZLE, KNOWN_SOLUTION))
    position = LessonPosition(
        id="roundtrip",
        technique=snapshot.technique,
        role=LessonRole.taught,
        puzzle=snapshot.puzzle,
        solution=snapshot.solution,
        grid=snapshot.grid,
        notes=snapshot.notes,
        step=snapshot.step,
        notes_issue=None,
    )
    restored = LessonPosition.model_validate_json(position.model_dump_json())
    assert restored == position


def test_load_pool_rejects_unknown_technique():
    with pytest.raises(ValueError, match="unknown lesson technique"):
        load_pool("jellyfish")


def _naked_single_step(**overrides: object) -> TechniqueStepPayload:
    payload: dict[str, object] = {
        "technique": Technique.NAKED_SINGLE,
        "outline_cells": [0],
        "focus_cells": [0],
        "elim_cells": [],
        "digit": 1,
        "digits": [1],
        "house": None,
        "house_index": None,
    }
    payload.update(overrides)
    return TechniqueStepPayload.model_validate(payload)


def test_declarative_types_reject_bad_lesson_values():
    with pytest.raises(ValidationError):
        _naked_single_step(digit=0)
    with pytest.raises(ValidationError):
        _naked_single_step(digit=True)
    with pytest.raises(ValidationError):
        _naked_single_step(focus_cells=[])
    raw = _naked_single_step().model_dump(mode="json")
    raw["house"] = "row"
    assert TechniqueStepPayload.model_validate_json(json.dumps(raw)).house == HouseKind.row
    raw["house"] = "tower"
    with pytest.raises(ValidationError):
        TechniqueStepPayload.model_validate_json(json.dumps(raw))
    with pytest.raises(ValidationError, match="sorted unique digits"):
        LessonPosition(
            id="bad-notes",
            technique=Technique.NAKED_SINGLE.value,
            role=LessonRole.taught,
            puzzle="0" * 81,
            solution="1" * 81,
            grid="0" * 81,
            notes={"0": [2, 1]},
            step=_naked_single_step(),
            notes_issue=None,
        )


def test_symmetry_keeps_naked_single():
    snapshot = next(iter_technique_snapshots(KNOWN_PUZZLE, KNOWN_SOLUTION))
    variant = symmetrize_lesson(snapshot, Random(1))
    assert variant.technique == snapshot.technique
    assert variant.grid != snapshot.grid
    validate_lesson_position(
        LessonPosition(
            id="sym-naked",
            technique=variant.technique,
            role=LessonRole.taught,
            puzzle=variant.puzzle,
            solution=variant.solution,
            grid=variant.grid,
            notes=variant.notes,
            step=variant.step,
            notes_issue=None,
        ),
    )


@pytest.mark.parametrize("technique", LESSON_TECHNIQUES)
def test_shared_lesson_pool_shape_and_invariants(technique):
    positions = load_pool(technique)
    assert len(positions) == LESSON_POOL_SIZE
    assert [position.id for position in positions] == [
        f"{technique}-{index:02d}" for index in range(1, LESSON_POOL_SIZE + 1)
    ]
    assert [position.role for position in positions] == ["taught"] + ["practice"] * (
        LESSON_POOL_SIZE - 1
    )
    for position in positions:
        _assert_live_lesson_step(position)


def _assert_live_lesson_step(position: LessonPosition) -> None:
    if position.technique == PENCIL_LESSON:
        issue = find_next_notes_issue(position.grid, position.notes)
        assert issue is not None
        assert issue.kind.value in {"empty", "incomplete"}
        return
    assert find_next_notes_issue(position.grid, position.notes) is None
    located = locate_next_technique_step(position.grid, position.notes)
    assert located is not None
    assert located.step.technique.value == position.technique


def test_taught_snapshot_response_omits_solution():
    for technique in LESSON_TECHNIQUES:
        positions = load_pool(technique)
        taught = next(position for position in positions if position.role == "taught")
        payload = TaughtLessonSnapshotResponse(
            technique=taught.technique,
            position_id=taught.id,
            grid=taught.grid,
            notes=taught.notes,
            has_practice=any(position.role == "practice" for position in positions),
            step=taught.step,
            notes_issue=taught.notes_issue,
        )
        dumped = payload.model_dump(mode="json")
        assert "solution" not in dumped
        assert "puzzle" not in dumped
        assert dumped["grid"] == taught.grid
        assert dumped["notes"] == taught.notes
        assert dumped["position_id"] == taught.id
        if technique == PENCIL_LESSON:
            assert dumped["step"] is None
            assert dumped["notes_issue"] == (
                None if taught.notes_issue is None else taught.notes_issue.model_dump(mode="json")
            )
        else:
            assert dumped["step"] == (
                None if taught.step is None else taught.step.model_dump(mode="json")
            )
            assert dumped["notes_issue"] is None


def test_lesson_objective_met_starts_false():
    for technique in LESSON_TECHNIQUES:
        position = taught_position(technique)
        assert lesson_objective_met(position, position.grid, position.notes) is False


def test_x_wing_objective_met_after_elims():
    position = taught_position("x_wing")
    if position.step is None:
        raise AssertionError("x_wing taught missing step")
    digit = position.step.digit
    notes = {key: list(digits) for key, digits in position.notes.items()}
    for index in position.step.elim_cells:
        key = str(index)
        remaining = [item for item in notes[key] if item != digit]
        if remaining:
            notes[key] = remaining
        else:
            del notes[key]
    assert lesson_objective_met(position, position.grid, notes) is True


def test_x_wing_objective_not_met_after_unrelated_note_clear():
    position = taught_position("x_wing")
    if position.step is None:
        raise AssertionError("x_wing taught missing step")
    digit = position.step.digit
    notes = {key: list(digits) for key, digits in position.notes.items()}
    for index in position.step.elim_cells:
        key = str(index)
        remaining = [item for item in notes[key] if item == digit]
        notes[key] = remaining
    assert lesson_objective_met(position, position.grid, notes) is False


def test_pencil_objective_met_when_required_notes_present():
    position = taught_position("pencil")
    if position.notes_issue is None:
        raise AssertionError("pencil taught missing notes_issue")
    notes = {
        str(position.notes_issue.cell_index): list(position.notes_issue.digits),
    }
    assert lesson_objective_met(position, position.grid, notes) is True


def test_naked_single_objective_met_when_digit_placed():
    position = taught_position("naked_single")
    if position.step is None:
        raise AssertionError("naked_single taught missing step")
    cells = list(position.grid)
    cells[position.step.focus_cells[0]] = str(position.step.digit)
    assert lesson_objective_met(position, "".join(cells), position.notes) is True


def test_naked_single_objective_met_on_any_starting_singleton():
    position = taught_position("naked_single")
    if position.step is None:
        raise AssertionError("naked_single taught missing step")
    stored = position.step.focus_cells[0]
    other = [
        (int(key), digits[0])
        for key, digits in position.notes.items()
        if len(digits) == 1 and int(key) != stored
    ]
    if not other:
        raise AssertionError("taught naked_single has no alternate singleton")
    index, digit = other[0]
    cells = list(position.grid)
    cells[index] = str(digit)
    assert lesson_objective_met(position, "".join(cells), position.notes) is True


def test_naked_single_objective_not_met_on_non_singleton_fill():
    position = taught_position("naked_single")
    solution = list(position.solution)
    multi_note = [
        int(key)
        for key, digits in position.notes.items()
        if len(digits) > 1 and position.grid[int(key)] == "0"
    ]
    if not multi_note:
        raise AssertionError("taught naked_single has no multi-note cell")
    index = multi_note[0]
    cells = list(position.grid)
    cells[index] = solution[index]
    assert lesson_objective_met(position, "".join(cells), position.notes) is False


def test_naked_single_objective_not_met_on_wrong_digit():
    position = taught_position("naked_single")
    if position.step is None:
        raise AssertionError("naked_single taught missing step")
    index = position.step.focus_cells[0]
    digit = position.step.digit
    cells = list(position.grid)
    cells[index] = str(1 if digit != 1 else 2)
    assert lesson_objective_met(position, "".join(cells), position.notes) is False


def _notes_without_digits(
    notes: dict[str, list[int]],
    removals: dict[int, set[int]],
) -> dict[str, list[int]]:
    updated = {key: list(digits) for key, digits in notes.items()}
    for index, digits in removals.items():
        key = str(index)
        remaining = [item for item in updated[key] if item not in digits]
        if remaining:
            updated[key] = remaining
        else:
            del updated[key]
    return updated


def _pointing_pair_step(position: LessonPosition) -> TechniqueStepPayload:
    step = position.step
    if step is None or step.digit is None or not step.elim_cells:
        raise AssertionError(f"{position.id} missing eliminations")
    return step


def test_pointing_pair_objective_met_by_the_stored_eliminations():
    for position in load_pool("pointing_pair"):
        step = _pointing_pair_step(position)
        notes = _notes_without_digits(
            position.notes,
            {index: {step.digit} for index in step.elim_cells},
        )
        assert lesson_objective_met(position, position.grid, notes) is True, position.id


def test_pointing_pair_objective_not_met_when_one_elimination_remains():
    for position in load_pool("pointing_pair"):
        step = _pointing_pair_step(position)
        kept = step.elim_cells[0]
        notes = _notes_without_digits(
            position.notes,
            {index: {step.digit} for index in step.elim_cells if index != kept},
        )
        assert lesson_objective_met(position, position.grid, notes) is False, position.id


def _swordfish_step(position: LessonPosition) -> TechniqueStepPayload:
    step = position.step
    if step is None or step.digit is None or not step.elim_cells:
        raise AssertionError(f"{position.id} missing eliminations")
    return step


def _fish_line_cells_outside_step(
    position: LessonPosition,
    step: TechniqueStepPayload,
) -> list[int]:
    skipped = set(step.focus_cells) | set(step.elim_cells)
    rows = {row_col(index)[0] for index in step.focus_cells}
    cols = {row_col(index)[1] for index in step.focus_cells}
    cells = [
        index
        for index, cell in enumerate(position.grid)
        if cell == "0"
        and index not in skipped
        and (row_col(index)[0] in rows or row_col(index)[1] in cols)
    ]
    if not cells:
        raise AssertionError(f"{position.id} has no fish-line cell outside elim_cells")
    return cells


def _notes_with_digit(notes: dict[str, list[int]], index: int, digit: int) -> None:
    key = str(index)
    notes[key] = sorted({*notes.get(key, []), digit})


def test_swordfish_objective_met_by_the_stored_eliminations():
    for position in load_pool("swordfish"):
        step = _swordfish_step(position)
        notes = _notes_without_digits(
            position.notes,
            {index: {step.digit} for index in step.elim_cells},
        )
        assert lesson_objective_met(position, position.grid, notes) is True, position.id


def test_swordfish_objective_not_met_when_one_elimination_returns():
    for position in load_pool("swordfish"):
        step = _swordfish_step(position)
        notes = _notes_without_digits(
            position.notes,
            {index: {step.digit} for index in step.elim_cells},
        )
        _notes_with_digit(notes, step.elim_cells[0], step.to_step().digit_value)
        assert lesson_objective_met(position, position.grid, notes) is False, position.id


def test_swordfish_objective_met_when_a_cell_outside_elim_cells_keeps_the_digit():
    for position in load_pool("swordfish"):
        step = _swordfish_step(position)
        digit = step.to_step().digit_value
        notes = _notes_without_digits(
            position.notes,
            {index: {digit} for index in step.elim_cells},
        )
        for index in _fish_line_cells_outside_step(position, step):
            _notes_with_digit(notes, index, digit)
        assert lesson_objective_met(position, position.grid, notes) is True, position.id


def _one_victim_elimination() -> tuple[LessonPosition, int, int]:
    position = taught_position("box_line_reduction")
    step = position.step
    if step is None or step.digit is None or len(step.elim_cells) != 1:
        raise AssertionError("box_line taught is not a one-victim elimination")
    return position, step.elim_cells[0], step.digit


def _grid_with_placed_digit(grid: str, index: int, digit: int) -> str:
    cells = list(grid)
    cells[index] = str(digit)
    return "".join(cells)


def test_one_victim_objective_not_met_when_the_eliminated_digit_is_placed():
    position, index, digit = _one_victim_elimination()
    grid = _grid_with_placed_digit(position.grid, index, digit)
    assert lesson_objective_met(position, grid, position.notes) is False


def test_one_victim_objective_met_when_another_digit_is_placed():
    position, index, digit = _one_victim_elimination()
    notes = position.notes[str(index)]
    if digit not in notes:
        raise AssertionError("box_line victim notes do not contain the eliminated digit")
    other = 1 if digit != 1 else 2
    grid = _grid_with_placed_digit(position.grid, index, other)
    assert lesson_objective_met(position, grid, position.notes) is True


def test_one_victim_objective_not_met_while_the_empty_victim_keeps_the_digit():
    position, index, digit = _one_victim_elimination()
    if position.grid[index] != "0":
        raise AssertionError("box_line victim is not empty")
    if digit not in position.notes[str(index)]:
        raise AssertionError("box_line victim notes do not contain the eliminated digit")
    assert lesson_objective_met(position, position.grid, position.notes) is False
