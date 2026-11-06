import random

from app.services.sudoku.grid import EMPTY_CELL, parse_grid
from app.services.sudoku.solver import count_solutions, solve


def givens_count(grid: str) -> int:
    return sum(1 for character in grid if character != "0")


def carve_puzzle(
    solution: str,
    rng: random.Random | None = None,
    min_givens: int = 17,
) -> str:
    if min_givens < 1 or min_givens > 81:
        raise ValueError("min_givens must be between 1 and 81")

    values = parse_grid(solution)
    if EMPTY_CELL in values:
        raise ValueError("solution must be a complete grid")
    if solve(solution) != solution:
        raise ValueError("solution must be a valid solved sudoku")

    random_source = rng or random.Random()
    puzzle_cells = list(solution)
    cell_indices = list(range(81))
    random_source.shuffle(cell_indices)
    remaining_givens = givens_count(solution)

    for index in cell_indices:
        if remaining_givens <= min_givens:
            break
        if puzzle_cells[index] == "0":
            continue

        removed_digit = puzzle_cells[index]
        puzzle_cells[index] = "0"
        remaining_givens -= 1
        puzzle = "".join(puzzle_cells)
        if count_solutions(puzzle, limit=2) == 1:
            continue
        puzzle_cells[index] = removed_digit
        remaining_givens += 1

    return "".join(puzzle_cells)
