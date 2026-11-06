from app.services.sudoku.grid import (
    BOX_SIDE,
    CELL_COUNT,
    EMPTY_CELL,
    GRID_SIDE,
    PEERS,
    format_grid,
    parse_grid,
)

# Bit d is digit d. Bit 0 is unused, so bits 1..9 are the nine digits.
_ALL_DIGITS = 0b1111111110

_ROW_OF = tuple(index // GRID_SIDE for index in range(CELL_COUNT))
_COL_OF = tuple(index % GRID_SIDE for index in range(CELL_COUNT))
_BOX_OF = tuple(
    (row // BOX_SIDE) * BOX_SIDE + (col // BOX_SIDE)
    for row, col in zip(_ROW_OF, _COL_OF, strict=True)
)


def is_valid_placement(values: list[int], index: int, value: int) -> bool:
    if value < 1 or value > GRID_SIDE:
        return False
    if index < 0 or index >= CELL_COUNT:
        raise ValueError(f"cell index out of bounds: {index}")
    return all(values[peer_index] != value for peer_index in PEERS[index])


def solve(grid: str) -> str | None:
    values = parse_grid(grid)
    prepared = _unit_masks(values)
    if prepared is None:
        return None
    if not _solve_values(values, *prepared):
        return None
    return format_grid(values)


def count_solutions(grid: str, limit: int = 2) -> int:
    if limit < 1:
        raise ValueError("limit must be at least 1")
    values = parse_grid(grid)
    prepared = _unit_masks(values)
    if prepared is None:
        return 0
    return _count_values(values, *prepared, limit)


def _unit_masks(values: list[int]) -> tuple[list[int], list[int], list[int]] | None:
    rows = [0] * GRID_SIDE
    cols = [0] * GRID_SIDE
    boxes = [0] * GRID_SIDE
    for index, digit in enumerate(values):
        if digit == EMPTY_CELL:
            continue
        bit = 1 << digit
        row = _ROW_OF[index]
        col = _COL_OF[index]
        box = _BOX_OF[index]
        if (rows[row] | cols[col] | boxes[box]) & bit:
            return None
        rows[row] |= bit
        cols[col] |= bit
        boxes[box] |= bit
    return rows, cols, boxes


def _candidate_mask(rows: list[int], cols: list[int], boxes: list[int], index: int) -> int:
    occupied = rows[_ROW_OF[index]] | cols[_COL_OF[index]] | boxes[_BOX_OF[index]]
    return ~occupied & _ALL_DIGITS


def _most_constrained_empty(
    values: list[int],
    rows: list[int],
    cols: list[int],
    boxes: list[int],
) -> tuple[int, int] | None:
    best_index = -1
    best_count = GRID_SIDE + 1
    best_mask = 0
    for index, digit in enumerate(values):
        if digit != EMPTY_CELL:
            continue
        mask = _candidate_mask(rows, cols, boxes, index)
        count = mask.bit_count()
        if count == 0:
            return index, 0
        if count < best_count:
            best_count = count
            best_index = index
            best_mask = mask
            if count == 1:
                # A later cell cannot be narrower, except one with no candidates,
                # and that branch has no solution either way.
                break
    if best_index < 0:
        return None
    return best_index, best_mask


def _flip(rows: list[int], cols: list[int], boxes: list[int], index: int, bit: int) -> None:
    rows[_ROW_OF[index]] ^= bit
    cols[_COL_OF[index]] ^= bit
    boxes[_BOX_OF[index]] ^= bit


def _solve_values(values: list[int], rows: list[int], cols: list[int], boxes: list[int]) -> bool:
    selected = _most_constrained_empty(values, rows, cols, boxes)
    if selected is None:
        return True
    index, mask = selected
    while mask:
        bit = mask & -mask
        values[index] = bit.bit_length() - 1
        _flip(rows, cols, boxes, index, bit)
        if _solve_values(values, rows, cols, boxes):
            return True
        _flip(rows, cols, boxes, index, bit)
        values[index] = EMPTY_CELL
        mask ^= bit
    return False


def _count_values(
    values: list[int],
    rows: list[int],
    cols: list[int],
    boxes: list[int],
    limit: int,
) -> int:
    selected = _most_constrained_empty(values, rows, cols, boxes)
    if selected is None:
        return 1
    index, mask = selected
    total = 0
    while mask:
        bit = mask & -mask
        values[index] = bit.bit_length() - 1
        _flip(rows, cols, boxes, index, bit)
        total += _count_values(values, rows, cols, boxes, limit - total)
        _flip(rows, cols, boxes, index, bit)
        values[index] = EMPTY_CELL
        if total >= limit:
            return limit
        mask ^= bit
    return total
