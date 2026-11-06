import random

from app.services.sudoku.carver import carve_puzzle, givens_count
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.grid import CELL_COUNT
from app.services.sudoku.solver import count_solutions, solve
from tests.sudoku.reference_solver import count_solutions as reference_count_solutions
from tests.sudoku.reference_solver import solve as reference_solve

_CARVED_SEEDS = range(150)
_UNDERCONSTRAINED_SEEDS = range(5)
_UNDERCONSTRAINED_GIVENS = 24


def _carved_puzzle(seed: int) -> str:
    rng = random.Random(seed)
    solution = generate_complete_grid(rng)
    min_givens = rng.randint(28, 45)
    return carve_puzzle(solution, rng, min_givens=min_givens)


def _underconstrained_puzzle(seed: int) -> str:
    rng = random.Random(seed)
    cells = list(generate_complete_grid(rng))
    order = list(range(CELL_COUNT))
    rng.shuffle(order)
    for index in order[: CELL_COUNT - _UNDERCONSTRAINED_GIVENS]:
        cells[index] = "0"
    return "".join(cells)


def test_carved_puzzles_match_reference_solver() -> None:
    for seed in _CARVED_SEEDS:
        puzzle = _carved_puzzle(seed)
        assert count_solutions(puzzle, limit=2) == reference_count_solutions(puzzle, limit=2), seed
        assert solve(puzzle) == reference_solve(puzzle), seed


def test_underconstrained_counts_match_reference_solver() -> None:
    for seed in _UNDERCONSTRAINED_SEEDS:
        puzzle = _underconstrained_puzzle(seed)
        assert givens_count(puzzle) == _UNDERCONSTRAINED_GIVENS, seed
        for limit in (2, 5):
            counted = count_solutions(puzzle, limit=limit)
            assert counted == reference_count_solutions(puzzle, limit=limit), (seed, limit)
            assert counted >= limit, (seed, limit)
