import random

from hypothesis import given, settings
from hypothesis import strategies as st

from app.services.sudoku.carver import carve_puzzle
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.solver import count_solutions, solve


@settings(max_examples=25, deadline=None)
@given(seed=st.integers(0, 10_000))
def test_carved_puzzle_has_one_solution(seed: int) -> None:
    rng = random.Random(seed)
    solution = generate_complete_grid(rng)
    puzzle = carve_puzzle(solution, rng, min_givens=40)
    assert count_solutions(puzzle) == 1
    assert solve(puzzle) == solution
