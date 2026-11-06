from app.services.sudoku.grid import (
    EMPTY_CELL,
    GRID_SIDE,
    box_cell_indices,
    col_cell_indices,
    parse_grid,
    row_cell_indices,
)


def is_valid_complete_grid(grid: str) -> bool:
    values = parse_grid(grid)
    if EMPTY_CELL in values:
        return False

    expected_digits = set(range(1, GRID_SIDE + 1))
    for row in range(GRID_SIDE):
        row_digits = {values[index] for index in row_cell_indices(row)}
        if row_digits != expected_digits:
            return False

    for col in range(GRID_SIDE):
        col_digits = {values[index] for index in col_cell_indices(col)}
        if col_digits != expected_digits:
            return False

    for box in range(GRID_SIDE):
        box_digits = {values[index] for index in box_cell_indices(box)}
        if box_digits != expected_digits:
            return False

    return True
