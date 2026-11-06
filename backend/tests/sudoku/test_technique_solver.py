import pytest

from app.services.sudoku.coach_step import (
    NotesIssueKind,
    candidate_layer_from_notes,
    candidates_after_medium_elims,
    candidates_after_step,
    find_next_notes_issue,
    find_next_technique_step,
    locate_next_technique_step,
)
from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.grader import GRADE_MEDIUM_MIN, grade_from_result
from app.services.sudoku.grid import EMPTY_CELL, HouseKind, parse_grid
from app.services.sudoku.lessons.store import load_pool
from app.services.sudoku.rater import (
    difficulty_from_result,
    matches_target_difficulty,
    rate_difficulty,
    rate_puzzle,
)
from app.services.sudoku.technique_registry import apply_scan, candidates_after, first_step_of
from app.services.sudoku.technique_solver import (
    ALL_TECHNIQUES,
    EASY_TECHNIQUES,
    MEDIUM_TECHNIQUES,
    Technique,
    TechniqueSolveResult,
    initial_candidates,
    solve_with_techniques,
)
from tests.fixtures import KNOWN_PUZZLE

SINGLES_ONLY_PUZZLE = (
    "003020600900305001001806400008102900700000008006708200002609500800203009005010300"
)

MEDIUM_PUZZLE = "270300590510000036000100820600000010000782059000000000080000000900043000060070000"

SHALLOW_MEDIUM_PUZZLE = (
    "000002010086054000510090020000500000740080150009000000060070091000003074470000308"
)

HARD_XY_WING_PUZZLE = (
    "300000000000354000765190000204000100010200705000001006920000000000067300073800014"
)


def test_solve_known_puzzle_with_singles_only():
    result = solve_with_techniques(KNOWN_PUZZLE, EASY_TECHNIQUES)
    assert result.solved
    assert result.hardest_technique == Technique.NAKED_SINGLE


def test_rate_known_puzzle_easy():
    assert rate_difficulty(KNOWN_PUZZLE) == Difficulty.easy


def test_rate_singles_only_puzzle_easy():
    assert rate_difficulty(SINGLES_ONLY_PUZZLE) == Difficulty.easy
    easy_only = solve_with_techniques(SINGLES_ONLY_PUZZLE, EASY_TECHNIQUES)
    assert easy_only.solved


def test_rate_medium_puzzle():
    assert rate_difficulty(MEDIUM_PUZZLE) == Difficulty.medium
    result = solve_with_techniques(MEDIUM_PUZZLE, ALL_TECHNIQUES)
    assert result.medium_step_count >= 2
    assert result.hard_step_count == 0
    easy_only = solve_with_techniques(MEDIUM_PUZZLE, EASY_TECHNIQUES)
    assert not easy_only.solved


def test_shallow_medium_is_rejected():
    rating = rate_puzzle(SHALLOW_MEDIUM_PUZZLE)
    assert rating.medium_step_count == 1
    assert grade_from_result(rating) < GRADE_MEDIUM_MIN
    assert not matches_target_difficulty(rating, Difficulty.medium)
    assert not matches_target_difficulty(rating, Difficulty.easy)
    with pytest.raises(ValueError, match="medium grade band"):
        rate_difficulty(SHALLOW_MEDIUM_PUZZLE)


def test_rate_hard_xy_wing_puzzle():
    assert rate_difficulty(HARD_XY_WING_PUZZLE) == Difficulty.hard
    result = solve_with_techniques(HARD_XY_WING_PUZZLE, ALL_TECHNIQUES)
    assert result.hardest_technique == Technique.XY_WING
    assert result.hard_step_count >= 1
    assert not solve_with_techniques(HARD_XY_WING_PUZZLE, MEDIUM_TECHNIQUES).solved


def test_shallow_replay_hard_has_single_hard_step():
    shallow = "090200000200500007800619000000025800070800090001000003000030780700000200009002016"
    rating = rate_puzzle(shallow)
    assert rating.hard_step_count == 1
    assert not matches_target_difficulty(rating, Difficulty.hard)
    assert not matches_target_difficulty(rating, Difficulty.medium)


def test_apply_x_wing_eliminates_digit():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    for col in (2, 5):
        candidates[1 * 9 + col] = {3}
        candidates[8 * 9 + col] = {3}
    candidates[4 * 9 + 2] = {3, 7}

    assert apply_scan(Technique.X_WING, values, candidates)
    assert 3 not in candidates[4 * 9 + 2]
    assert 7 in candidates[4 * 9 + 2]


def test_apply_swordfish_eliminates_digit():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    # Rows 0, 2, 5 confine digit 4 to columns 1, 4, 7.
    for row in (0, 2, 5):
        for col in (1, 4, 7):
            candidates[row * 9 + col] = {4}
    candidates[3 * 9 + 1] = {4, 8}
    candidates[7 * 9 + 7] = {4, 2}

    assert apply_scan(Technique.SWORDFISH, values, candidates)
    assert 4 not in candidates[3 * 9 + 1]
    assert 8 in candidates[3 * 9 + 1]
    assert 4 not in candidates[7 * 9 + 7]
    assert 2 in candidates[7 * 9 + 7]


def test_apply_xyz_wing_eliminates_digit():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    # Pivot r0c0 = {1,2,3}; pincer same row r0c1 = {1,3}; pincer same col r1c0 = {2,3}.
    # Victim r1c1 sees pivot and both pincers (same box) → lose 3.
    candidates[0] = {1, 2, 3}
    candidates[1] = {1, 3}
    candidates[9] = {2, 3}
    candidates[10] = {3, 5}

    assert apply_scan(Technique.XYZ_WING, values, candidates)
    assert 3 not in candidates[10]
    assert 5 in candidates[10]


def test_apply_xyz_wing_requires_victim_to_see_pivot():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    # Pivot r4c4={1,2,3}; wings r4c0={1,3} and r0c4={2,3}.
    # Victim r0c0 sees both wings but not the pivot → must keep 3.
    candidates[4 * 9 + 4] = {1, 2, 3}
    candidates[4 * 9 + 0] = {1, 3}
    candidates[0 * 9 + 4] = {2, 3}
    candidates[0 * 9 + 0] = {3, 5}

    assert not apply_scan(Technique.XYZ_WING, values, candidates)
    assert 3 in candidates[0]


def test_pointing_pair_outline_is_elimination_cells():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    candidates[0] = {5, 6}
    candidates[9] = {5, 7}
    candidates[27] = {5, 8}
    step = first_step_of(Technique.POINTING_PAIR, values, candidates)
    assert step is not None
    assert step.technique == Technique.POINTING_PAIR
    assert step.digit == 5
    assert step.house == HouseKind.box
    assert step.house_index == 0
    assert step.focus_cells == (0, 9)
    assert step.outline_cells == (0, 1, 2, 9, 10, 11, 18, 19, 20)
    assert step.elim_cells == (27,)
    after = candidates_after_step(step, values, candidates)
    assert 5 not in after[27]
    assert 5 in after[0]
    assert 5 in after[9]


def test_x_wing_coach_step_sets_house_and_elim_cells():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    for col in (2, 5):
        candidates[1 * 9 + col] = {3}
        candidates[8 * 9 + col] = {3}
    candidates[4 * 9 + 2] = {3, 7}
    step = first_step_of(Technique.X_WING, values, candidates)
    assert step is not None
    assert step.technique == Technique.X_WING
    assert step.house == HouseKind.row
    assert step.digit == 3
    assert step.elim_cells == (4 * 9 + 2,)


def test_x_wing_column_coach_step_sets_house_and_elim_cells():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    for row in (2, 5):
        candidates[row * 9 + 1] = {3}
        candidates[row * 9 + 8] = {3}
    candidates[2 * 9 + 4] = {3, 7}
    step = first_step_of(Technique.X_WING, values, candidates)
    assert step is not None
    assert step.house == HouseKind.col
    assert step.elim_cells == (2 * 9 + 4,)


def test_swordfish_coach_step_sets_house_and_elim_cells():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    for row in (0, 2, 5):
        for col in (1, 4, 7):
            candidates[row * 9 + col] = {4}
    candidates[3 * 9 + 1] = {4, 8}
    candidates[7 * 9 + 7] = {4, 2}
    step = first_step_of(Technique.SWORDFISH, values, candidates)
    assert step is not None
    assert step.technique == Technique.SWORDFISH
    assert step.house == HouseKind.row
    assert step.digit == 4
    assert step.elim_cells == (3 * 9 + 1, 7 * 9 + 7)


def test_swordfish_candidates_after_removes_digit_only_from_elim_cells():
    for position in load_pool("swordfish"):
        payload = position.step
        if payload is None or payload.digit is None or not payload.elim_cells:
            raise AssertionError(f"{position.id} missing eliminations")
        step = payload.to_step()
        values = parse_grid(position.grid)
        before = initial_candidates(values)
        after = candidates_after(step, values, before)
        recorded = set(step.elim_cells)
        for index, (prior, later) in enumerate(zip(before, after, strict=True)):
            if index in recorded:
                assert step.digit_value in prior, (position.id, index)
                assert later == prior - {step.digit_value}, (position.id, index)
                continue
            assert later == prior, (position.id, index)


def test_box_line_coach_step_sets_elim_cells():
    values = [0] * 81
    candidates = [set() for _ in range(81)]
    candidates[0] = {5, 6}
    candidates[1] = {5, 7}
    candidates[9] = {5, 8}
    step = first_step_of(Technique.BOX_LINE_REDUCTION, values, candidates)
    assert step is not None
    assert step.technique == Technique.BOX_LINE_REDUCTION
    assert step.digit == 5
    assert step.house == HouseKind.row
    assert step.elim_cells == (9,)


def test_naked_pair_coach_step_sets_elim_cells():
    values = [0] * 81
    candidates = [set(range(1, 10)) for _ in range(81)]
    candidates[0] = {1, 2}
    candidates[1] = {1, 2}
    step = first_step_of(Technique.NAKED_PAIR, values, candidates)
    assert step is not None
    assert step.technique == Technique.NAKED_PAIR
    assert step.focus_cells == (0, 1)
    assert 2 in step.elim_cells
    assert 0 not in step.elim_cells
    assert 1 not in step.elim_cells


def test_difficulty_from_result_uses_path_aware_grade():
    assert (
        difficulty_from_result(
            TechniqueSolveResult(True, Technique.HIDDEN_SINGLE, frozenset()),
        )
        == Difficulty.easy
    )
    # Pointing ceiling alone stays below medium band (not easy either).
    with pytest.raises(ValueError, match="medium grade band"):
        difficulty_from_result(
            TechniqueSolveResult(
                True,
                Technique.POINTING_PAIR,
                frozenset(),
                medium_step_count=0,
                easy_step_count=8,
            ),
        )
    assert (
        difficulty_from_result(
            TechniqueSolveResult(
                True,
                Technique.POINTING_PAIR,
                frozenset(),
                medium_step_count=1,
                easy_step_count=8,
            ),
        )
        == Difficulty.medium
    )
    # One hard elimination without volume is unclassifiable (not medium).
    with pytest.raises(ValueError, match="hard grade band"):
        difficulty_from_result(
            TechniqueSolveResult(
                True,
                Technique.XY_WING,
                frozenset(),
                hard_step_count=1,
                medium_step_count=1,
                easy_step_count=10,
            ),
        )
    # Harder ceiling + repeated hard steps crosses hard band.
    assert (
        difficulty_from_result(
            TechniqueSolveResult(
                True,
                Technique.XY_WING,
                frozenset(),
                hard_step_count=2,
                medium_step_count=5,
                easy_step_count=10,
            ),
        )
        == Difficulty.hard
    )
    assert difficulty_from_result(TechniqueSolveResult(True, None, frozenset())) == Difficulty.easy


def test_coach_step_known_puzzle_is_naked_single():
    step = find_next_technique_step(KNOWN_PUZZLE)
    assert step is not None
    assert step.technique == Technique.NAKED_SINGLE
    assert step.digit is not None
    assert step.house is None
    assert len(step.focus_cells) == 1
    assert step.outline_cells == step.focus_cells


def test_coach_step_exists_for_medium_and_hard_fixtures():
    assert find_next_technique_step(MEDIUM_PUZZLE) is not None
    assert find_next_technique_step(HARD_XY_WING_PUZZLE) is not None


def _complete_basic_notes(values: list[int], candidates: list[set[int]]) -> dict[str, list[int]]:
    return {
        str(index): sorted(candidates[index])
        for index, value in enumerate(values)
        if value == EMPTY_CELL
    }


def _grid_after_singles(grid: str) -> str:
    values = parse_grid(grid)
    candidates = initial_candidates(values)
    while apply_scan(Technique.NAKED_SINGLE, values, candidates) or apply_scan(
        Technique.HIDDEN_SINGLE, values, candidates
    ):
        pass
    return "".join("0" if value == EMPTY_CELL else str(value) for value in values)


def test_notes_issue_empty_board_points_at_first_empty_cell():
    values = parse_grid(KNOWN_PUZZLE)
    issue = find_next_notes_issue(KNOWN_PUZZLE, {})
    assert issue is not None
    assert issue.kind == NotesIssueKind.empty
    first_empty = next(index for index, value in enumerate(values) if value == EMPTY_CELL)
    assert issue.cell_index == first_empty


def test_notes_issue_prefers_illegal_note_over_empty_cells():
    values = parse_grid(MEDIUM_PUZZLE)
    filled = next(index for index, value in enumerate(values) if value != EMPTY_CELL)
    digit = values[filled]
    empty = next(
        index
        for index, value in enumerate(values)
        if value == EMPTY_CELL and digit not in initial_candidates(values)[index]
    )
    issue = find_next_notes_issue(MEDIUM_PUZZLE, {str(empty): [digit]})
    assert issue is not None
    assert issue.kind == NotesIssueKind.illegal
    assert issue.cell_index == empty
    assert issue.digit == digit
    assert issue.house is not None


def test_notes_issue_does_not_demand_xyz_digit_already_removed():
    victim = 15
    notes = {
        "0": [1, 5, 7],
        "1": [3, 8],
        "2": [1, 5, 7],
        "3": [1, 5, 7],
        "6": [3, 8],
        "10": [3, 8],
        "12": [1, 5, 7],
        "14": [5, 7],
        "15": [1, 3, 7, 8],
        "17": [7, 8],
        "18": [1, 2, 7],
        "19": [1, 6],
        "20": [1, 2, 6, 7],
        "24": [1, 5, 7],
        "25": [1, 5],
        "30": [3, 9],
        "31": [5, 7, 9],
        "32": [3, 5, 7],
        "33": [1, 5, 7, 8],
        "34": [1, 3, 5],
        "35": [7, 8],
        "38": [3, 5],
        "43": [3, 5],
        "45": [1, 5],
        "47": [1, 3, 5],
        "49": [4, 5, 7],
        "50": [3, 4, 5, 7],
        "51": [5, 7],
        "54": [1, 9],
        "58": [5, 9],
        "59": [1, 5],
        "63": [1, 2, 7, 9],
        "64": [1, 6],
        "65": [1, 2, 6, 7],
        "66": [3, 9],
        "67": [4, 7, 9],
        "68": [1, 2, 3, 4, 7],
        "69": [4, 6],
        "74": [2, 6, 7],
        "75": [7],
        "77": [2, 4, 7],
        "78": [4, 6],
    }
    grid = "000029046409060020000438009624000000870216904090800062048600273000000085350080091"
    values = parse_grid(grid)
    basic = initial_candidates(values)
    required = candidates_after_medium_elims(
        values,
        candidate_layer_from_notes(values, basic, notes),
    )
    assert 5 not in required[victim]
    issue = find_next_notes_issue(grid, notes)
    assert issue is None or issue.cell_index != victim or 5 not in issue.digits


def test_ahead_pair_elimination_is_not_a_notes_issue():
    reduced = _grid_after_singles(SHALLOW_MEDIUM_PUZZLE)
    step = find_next_technique_step(reduced)
    assert step is not None
    assert step.technique == Technique.NAKED_PAIR
    values = parse_grid(reduced)
    candidates = initial_candidates(values)
    notes = _complete_basic_notes(values, candidates)
    pair = set(step.digits)
    for index in step.outline_cells:
        if values[index] != EMPTY_CELL or index in step.focus_cells:
            continue
        notes[str(index)] = sorted(set(notes[str(index)]) - pair)
    assert find_next_notes_issue(reduced, notes) is None


def test_hidden_pair_missing_pair_digit_is_incomplete():
    reduced = _grid_after_singles(MEDIUM_PUZZLE)
    step = find_next_technique_step(reduced)
    assert step is not None
    assert step.technique == Technique.HIDDEN_PAIR
    values = parse_grid(reduced)
    candidates = initial_candidates(values)
    notes = _complete_basic_notes(values, candidates)
    pair = set(step.digits)
    dropped = min(pair)
    target = step.focus_cells[0]
    for index in step.focus_cells:
        notes[str(index)] = sorted(pair)
    notes[str(target)] = sorted(pair - {dropped})
    issue = find_next_notes_issue(reduced, notes)
    assert issue is not None
    assert issue.kind == NotesIssueKind.incomplete
    assert issue.cell_index in step.focus_cells
    assert dropped in issue.digits
    again = find_next_technique_step(reduced, notes)
    assert again is not None
    assert again.focus_cells == step.focus_cells
    assert again.technique == Technique.HIDDEN_PAIR


def test_hidden_pair_pair_notes_are_not_repeated():
    reduced = _grid_after_singles(MEDIUM_PUZZLE)
    step = find_next_technique_step(reduced)
    assert step is not None
    assert step.technique == Technique.HIDDEN_PAIR
    pair_notes = {str(index): list(step.digits) for index in step.focus_cells}
    assert any(
        initial_candidates(parse_grid(reduced))[index] != set(step.digits)
        for index in step.focus_cells
    )
    next_step = find_next_technique_step(reduced, pair_notes)
    assert next_step is not None
    assert next_step.focus_cells != step.focus_cells or next_step.technique != step.technique


def test_naked_pair_is_done_when_pair_digits_leave_other_cells():
    reduced = _grid_after_singles(SHALLOW_MEDIUM_PUZZLE)
    step = find_next_technique_step(reduced)
    assert step is not None
    assert step.technique == Technique.NAKED_PAIR
    values = parse_grid(reduced)
    candidates = initial_candidates(values)
    pair = set(step.digits)
    notes = {str(index): sorted(pair) for index in step.focus_cells}
    for index in step.outline_cells:
        if values[index] != EMPTY_CELL or index in step.focus_cells:
            continue
        remaining = candidates[index] - pair
        if remaining == candidates[index]:
            continue
        notes[str(index)] = sorted(remaining)[1:] or sorted(remaining)
    next_step = find_next_technique_step(reduced, notes)
    assert next_step is None or (
        next_step.focus_cells != step.focus_cells or next_step.technique != step.technique
    )


def test_locate_next_technique_skips_to_xy_wing_after_applied_elims():
    grid = HARD_XY_WING_PUZZLE
    notes: dict[str, list[int]] = {}
    located = None
    for _ in range(80):
        located = locate_next_technique_step(grid, notes)
        assert located is not None
        values = parse_grid(grid)
        if located.step.technique == Technique.XY_WING:
            break
        if located.step.technique in EASY_TECHNIQUES:
            filled_index = located.step.focus_cells[0]
            values[filled_index] = located.step.digit_value
            grid = "".join("0" if value == EMPTY_CELL else str(value) for value in values)
            notes.pop(str(filled_index), None)
            continue
        after = candidates_after_step(located.step, values, located.candidates)
        for index, value in enumerate(values):
            if value != EMPTY_CELL or located.candidates[index] == after[index]:
                continue
            notes[str(index)] = sorted(after[index])
    else:
        raise AssertionError("expected an XY-Wing after skipping earlier steps")
    assert located.step.technique == Technique.XY_WING
    assert located.step.digit is not None
    assert located.step.digit not in located.step.digits
    assert len(located.step.digits) == 2


def test_rate_difficulty_rejects_unsolvable_puzzle():
    unsolvable = list(KNOWN_PUZZLE)
    unsolvable[0] = "4"
    with pytest.raises(ValueError, match="human techniques"):
        rate_difficulty("".join(unsolvable))
