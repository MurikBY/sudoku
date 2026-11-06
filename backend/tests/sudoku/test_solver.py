import pytest

from app.services.sudoku.grid import cell_index, format_grid, parse_grid
from app.services.sudoku.solver import count_solutions, is_valid_placement, solve
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION
from tests.sudoku.reference_solver import count_solutions as reference_count_solutions

# Empty grid has many solutions; counting stops once limit is reached.
EMPTY_GRID = "0" * 81

# Adding a whole subtree before the limit check returns 4 on this grid.
SUBTREE_OVERSHOOT_GRID = (
    "005080000000000210000360870306900740002800300000001006030590000209618000000000000"
)


def test_is_valid_placement_rejects_conflicts():
    values = parse_grid("0" * 81)
    values[cell_index(0, 0)] = 5
    assert is_valid_placement(values, cell_index(0, 1), 5) is False
    assert is_valid_placement(values, cell_index(0, 1), 4) is True


def test_is_valid_placement_rejects_out_of_range_digits():
    values = parse_grid("0" * 81)
    assert is_valid_placement(values, 0, 0) is False
    assert is_valid_placement(values, 0, 10) is False


def test_solve_known_puzzle():
    assert solve(KNOWN_PUZZLE) == KNOWN_SOLUTION


def test_solve_returns_none_for_unsolvable_grid():
    unsolvable = list(KNOWN_PUZZLE)
    unsolvable[0] = "4"
    assert solve("".join(unsolvable)) is None


def test_count_solutions_finds_unique_solution():
    assert count_solutions(KNOWN_PUZZLE, limit=2) == 1


def test_count_solutions_stops_at_limit():
    assert count_solutions(EMPTY_GRID, limit=2) == 2


def test_count_solutions_caps_a_subtree_that_would_pass_the_limit():
    assert count_solutions(SUBTREE_OVERSHOOT_GRID, limit=2) == 2
    assert reference_count_solutions(SUBTREE_OVERSHOOT_GRID, limit=2) == 2


def test_count_solutions_rejects_invalid_limit():
    with pytest.raises(ValueError, match="limit"):
        count_solutions(KNOWN_PUZZLE, limit=0)


def test_solve_complete_grid_is_identity():
    values = parse_grid(KNOWN_SOLUTION)
    assert solve(format_grid(values)) == KNOWN_SOLUTION
