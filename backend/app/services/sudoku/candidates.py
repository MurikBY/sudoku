from app.services.sudoku.grid import CELL_COUNT, EMPTY_CELL, GRID_SIDE, peer_indices
from app.services.sudoku.solver import is_valid_placement


def initial_candidates(values: list[int]) -> list[set[int]]:
    candidates: list[set[int]] = [set() for _ in range(CELL_COUNT)]
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        for digit in range(1, GRID_SIDE + 1):
            if is_valid_placement(values, index, digit):
                candidates[index].add(digit)
    return candidates


def is_solved(values: list[int]) -> bool:
    return all(value != EMPTY_CELL for value in values)


def has_candidate_contradiction(values: list[int], candidates: list[set[int]]) -> bool:
    return any(value == EMPTY_CELL and not candidates[index] for index, value in enumerate(values))


def place_digit(values: list[int], candidates: list[set[int]], index: int, digit: int) -> None:
    values[index] = digit
    candidates[index] = set()
    for peer_index in peer_indices(index):
        candidates[peer_index].discard(digit)
