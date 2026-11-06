import random

from app.services.sudoku.carver import carve_puzzle, givens_count
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.solver import count_solutions, solve
from tests.sudoku.helpers import is_valid_complete_grid


def test_generate_complete_grid_is_valid():
    grid = generate_complete_grid(random.Random(7))
    assert is_valid_complete_grid(grid)
    assert solve(grid) == grid


def test_generate_complete_grid_varies_with_seed():
    first = generate_complete_grid(random.Random(1))
    second = generate_complete_grid(random.Random(2))
    assert first != second


def test_generate_many_complete_grids_are_valid():
    rng = random.Random(99)
    for _ in range(20):
        assert is_valid_complete_grid(generate_complete_grid(rng))


def test_carve_puzzle_has_unique_solution_matching_original():
    solution = generate_complete_grid(random.Random(11))
    puzzle = carve_puzzle(solution, random.Random(12), min_givens=17)
    assert givens_count(puzzle) < givens_count(solution)
    assert count_solutions(puzzle, limit=2) == 1
    assert solve(puzzle) == solution


def test_carve_puzzle_respects_min_givens():
    solution = generate_complete_grid(random.Random(21))
    puzzle = carve_puzzle(solution, random.Random(22), min_givens=30)
    assert givens_count(puzzle) >= 30


def test_carve_puzzle_rejects_incomplete_solution():
    incomplete = "0" * 81
    try:
        carve_puzzle(incomplete)
    except ValueError as error:
        assert "complete" in str(error)
    else:
        raise AssertionError("expected ValueError for incomplete solution")


def test_carve_puzzle_rejects_invalid_min_givens():
    solution = generate_complete_grid(random.Random(31))
    try:
        carve_puzzle(solution, min_givens=0)
    except ValueError as error:
        assert "min_givens" in str(error)
    else:
        raise AssertionError("expected ValueError for invalid min_givens")
