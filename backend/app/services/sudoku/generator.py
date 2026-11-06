import random

from app.services.sudoku.grid import (
    BOX_SIDE,
    CELL_COUNT,
    EMPTY_CELL,
    GRID_SIDE,
    box_origin,
    cell_index,
    format_grid,
)
from app.services.sudoku.solver import is_valid_placement


def generate_complete_grid(rng: random.Random | None = None) -> str:
    random_source = rng or random.Random()
    values = [EMPTY_CELL] * CELL_COUNT
    _fill_diagonal_boxes(values, random_source)
    if not _solve_values_random(values, random_source):
        raise RuntimeError("failed to generate complete sudoku grid")
    return format_grid(values)


def _fill_diagonal_boxes(values: list[int], rng: random.Random) -> None:
    for box in (0, 4, 8):
        _fill_box(values, box, rng)


def _fill_box(values: list[int], box: int, rng: random.Random) -> None:
    digits = list(range(1, GRID_SIDE + 1))
    rng.shuffle(digits)
    box_row, box_col = box_origin(box)
    digit_index = 0
    for row_offset in range(BOX_SIDE):
        for col_offset in range(BOX_SIDE):
            index = cell_index(box_row + row_offset, box_col + col_offset)
            values[index] = digits[digit_index]
            digit_index += 1


def _solve_values_random(values: list[int], rng: random.Random) -> bool:
    empty_index = _first_empty_index(values)
    if empty_index is None:
        return True

    digits = list(range(1, GRID_SIDE + 1))
    rng.shuffle(digits)
    for digit in digits:
        if not is_valid_placement(values, empty_index, digit):
            continue
        values[empty_index] = digit
        if _solve_values_random(values, rng):
            return True
        values[empty_index] = EMPTY_CELL
    return False


def _first_empty_index(values: list[int]) -> int | None:
    for index, value in enumerate(values):
        if value == EMPTY_CELL:
            return index
    return None
