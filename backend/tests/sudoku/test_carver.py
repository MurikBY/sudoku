import random

from app.services.sudoku.carver import carve_puzzle, givens_count
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.solver import count_solutions, solve


def test_givens_count_counts_non_zero_cells():
    assert givens_count("100000000" + "0" * 72) == 1
    assert givens_count("0" * 81) == 0


def test_carve_puzzle_is_reproducible_with_seed():
    solution = generate_complete_grid(random.Random(41))
    first = carve_puzzle(solution, random.Random(42), min_givens=20)
    second = carve_puzzle(solution, random.Random(42), min_givens=20)
    assert first == second


def test_carved_puzzle_cells_are_subset_of_solution():
    solution = generate_complete_grid(random.Random(51))
    puzzle = carve_puzzle(solution, random.Random(52), min_givens=25)
    for puzzle_digit, solution_digit in zip(puzzle, solution, strict=True):
        if puzzle_digit != "0":
            assert puzzle_digit == solution_digit


def test_carve_multiple_times_stays_unique():
    solution = generate_complete_grid(random.Random(61))
    for seed in range(5):
        puzzle = carve_puzzle(solution, random.Random(seed), min_givens=22)
        assert count_solutions(puzzle, limit=2) == 1
        assert solve(puzzle) == solution
