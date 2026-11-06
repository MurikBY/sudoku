import pytest

from app.services.sudoku.grid import cell_index
from app.services.sudoku.validator import (
    conflict_indices,
    has_conflicts,
    is_complete,
    is_correct_player_digit,
    is_move_mistake,
    matches_solution,
    validate_move,
    validate_player_grid,
    wrong_digit_indices,
)
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION


def test_conflict_indices_finds_duplicate_in_row():
    grid = list(KNOWN_PUZZLE)
    grid[cell_index(0, 0)] = "5"
    grid[cell_index(0, 3)] = "5"
    conflicts = conflict_indices("".join(grid))
    assert cell_index(0, 0) in conflicts
    assert cell_index(0, 3) in conflicts


def test_has_conflicts_false_for_valid_player_grid():
    assert not has_conflicts(KNOWN_PUZZLE)


def test_is_complete_false_for_partial_grid():
    assert not is_complete(KNOWN_PUZZLE)


def test_is_complete_false_when_filled_but_conflicting():
    grid = ["5"] * 81
    assert not is_complete("".join(grid))


def test_is_complete_true_for_solution():
    assert is_complete(KNOWN_SOLUTION)


def test_matches_solution_requires_exact_solution():
    assert matches_solution(KNOWN_SOLUTION, KNOWN_SOLUTION)
    assert not matches_solution(KNOWN_PUZZLE, KNOWN_SOLUTION)


def test_validate_player_grid_accepts_matching_givens():
    validate_player_grid(KNOWN_PUZZLE, KNOWN_PUZZLE)


def test_validate_player_grid_rejects_modified_given():
    given_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char != "0")
    player_grid = list(KNOWN_PUZZLE)
    player_grid[given_index] = "1" if player_grid[given_index] != "1" else "2"
    with pytest.raises(ValueError, match=f"given cell {given_index}"):
        validate_player_grid(KNOWN_PUZZLE, "".join(player_grid))


def test_validate_move_allows_clearing_empty_cell():
    validate_move(KNOWN_PUZZLE, KNOWN_PUZZLE, cell_index(0, 0), 0)


def test_validate_move_allows_filling_empty_cell():
    player_grid = list(KNOWN_PUZZLE)
    player_grid[cell_index(0, 0)] = "1"
    validate_move(KNOWN_PUZZLE, KNOWN_PUZZLE, cell_index(0, 0), 1)


def test_validate_move_rejects_given_cell_change():
    given_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char != "0")
    with pytest.raises(ValueError, match="cannot modify given cell"):
        validate_move(KNOWN_PUZZLE, KNOWN_PUZZLE, given_index, 1)


def test_validate_move_rejects_out_of_range_value():
    with pytest.raises(ValueError, match="cell value out of range"):
        validate_move(KNOWN_PUZZLE, KNOWN_PUZZLE, cell_index(0, 0), 10)


def test_validate_move_rejects_out_of_bounds_index():
    with pytest.raises(ValueError, match="cell index out of bounds"):
        validate_move(KNOWN_PUZZLE, KNOWN_PUZZLE, 81, 1)


def test_wrong_digit_indices_marks_incorrect_player_cells():
    player_grid = list(KNOWN_PUZZLE)
    wrong_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_value = int(KNOWN_SOLUTION[wrong_index])
    wrong_value = 1 if correct_value != 1 else 2
    player_grid[wrong_index] = str(wrong_value)
    wrong = wrong_digit_indices("".join(player_grid), KNOWN_PUZZLE, KNOWN_SOLUTION)
    assert wrong_index in wrong


def test_wrong_digit_indices_ignores_givens_and_empty_cells():
    assert not wrong_digit_indices(KNOWN_PUZZLE, KNOWN_PUZZLE, KNOWN_SOLUTION)


def test_is_move_mistake_detects_wrong_digit_only():
    wrong_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_digit = int(KNOWN_SOLUTION[wrong_index])
    wrong_digit = 1 if correct_digit != 1 else 2
    assert is_move_mistake(wrong_index, wrong_digit, KNOWN_SOLUTION)
    assert not is_move_mistake(wrong_index, 0, KNOWN_SOLUTION)
    assert not is_move_mistake(wrong_index, correct_digit, KNOWN_SOLUTION)


def test_is_correct_player_digit():
    empty_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    given_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char != "0")
    correct_digit = int(KNOWN_SOLUTION[empty_index])
    wrong_digit = 1 if correct_digit != 1 else 2

    assert not is_correct_player_digit(
        KNOWN_PUZZLE,
        KNOWN_PUZZLE,
        KNOWN_SOLUTION,
        empty_index,
    )
    assert not is_correct_player_digit(
        KNOWN_PUZZLE,
        KNOWN_PUZZLE,
        KNOWN_SOLUTION,
        given_index,
    )

    correct_grid = list(KNOWN_PUZZLE)
    correct_grid[empty_index] = str(correct_digit)
    assert is_correct_player_digit(
        KNOWN_PUZZLE,
        "".join(correct_grid),
        KNOWN_SOLUTION,
        empty_index,
    )

    wrong_grid = list(KNOWN_PUZZLE)
    wrong_grid[empty_index] = str(wrong_digit)
    assert not is_correct_player_digit(
        KNOWN_PUZZLE,
        "".join(wrong_grid),
        KNOWN_SOLUTION,
        empty_index,
    )
