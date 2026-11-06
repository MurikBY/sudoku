from dataclasses import dataclass
from enum import StrEnum

GRID_SIDE = 9
BOX_SIDE = 3
CELL_COUNT = GRID_SIDE * GRID_SIDE
EMPTY_CELL = 0


class HouseKind(StrEnum):
    row = "row"
    col = "col"
    box = "box"


@dataclass(frozen=True)
class House:
    kind: HouseKind
    index: int
    cells: tuple[int, ...]


def cell_index(row: int, col: int) -> int:
    if row < 0 or row >= GRID_SIDE or col < 0 or col >= GRID_SIDE:
        raise ValueError(f"cell out of bounds: row={row}, col={col}")
    return row * GRID_SIDE + col


def row_col(index: int) -> tuple[int, int]:
    if index < 0 or index >= CELL_COUNT:
        raise ValueError(f"cell index out of bounds: {index}")
    return divmod(index, GRID_SIDE)


def box_index(row: int, col: int) -> int:
    return (row // BOX_SIDE) * BOX_SIDE + (col // BOX_SIDE)


def box_origin(box: int) -> tuple[int, int]:
    if box < 0 or box >= GRID_SIDE:
        raise ValueError(f"box index out of bounds: {box}")
    return (box // BOX_SIDE) * BOX_SIDE, (box % BOX_SIDE) * BOX_SIDE


def _row_units() -> tuple[tuple[int, ...], ...]:
    return tuple(
        tuple(range(row * GRID_SIDE, row * GRID_SIDE + GRID_SIDE)) for row in range(GRID_SIDE)
    )


def _col_units() -> tuple[tuple[int, ...], ...]:
    return tuple(
        tuple(row * GRID_SIDE + col for row in range(GRID_SIDE)) for col in range(GRID_SIDE)
    )


def _box_units() -> tuple[tuple[int, ...], ...]:
    boxes: list[tuple[int, ...]] = []
    for box in range(GRID_SIDE):
        box_row = (box // BOX_SIDE) * BOX_SIDE
        box_col = (box % BOX_SIDE) * BOX_SIDE
        boxes.append(
            tuple(
                (box_row + row_offset) * GRID_SIDE + box_col + col_offset
                for row_offset in range(BOX_SIDE)
                for col_offset in range(BOX_SIDE)
            )
        )
    return tuple(boxes)


def _peer_units(
    rows: tuple[tuple[int, ...], ...],
    cols: tuple[tuple[int, ...], ...],
    boxes: tuple[tuple[int, ...], ...],
) -> tuple[frozenset[int], ...]:
    peers: list[frozenset[int]] = []
    for index in range(CELL_COUNT):
        row, col = divmod(index, GRID_SIDE)
        box = (row // BOX_SIDE) * BOX_SIDE + (col // BOX_SIDE)
        cells = set(rows[row])
        cells.update(cols[col])
        cells.update(boxes[box])
        cells.discard(index)
        peers.append(frozenset(cells))
    return tuple(peers)


def _houses(
    rows: tuple[tuple[int, ...], ...],
    cols: tuple[tuple[int, ...], ...],
    boxes: tuple[tuple[int, ...], ...],
) -> tuple[House, ...]:
    return (
        tuple(House(HouseKind.row, index, cells) for index, cells in enumerate(rows))
        + tuple(House(HouseKind.col, index, cells) for index, cells in enumerate(cols))
        + tuple(House(HouseKind.box, index, cells) for index, cells in enumerate(boxes))
    )


ROWS: tuple[tuple[int, ...], ...] = _row_units()
COLS: tuple[tuple[int, ...], ...] = _col_units()
BOXES: tuple[tuple[int, ...], ...] = _box_units()
HOUSES: tuple[House, ...] = _houses(ROWS, COLS, BOXES)
PEERS: tuple[frozenset[int], ...] = _peer_units(ROWS, COLS, BOXES)


def box_cell_indices(box: int) -> list[int]:
    if box < 0 or box >= GRID_SIDE:
        raise ValueError(f"box index out of bounds: {box}")
    return list(BOXES[box])


def row_cell_indices(row: int) -> list[int]:
    if row < 0 or row >= GRID_SIDE:
        raise ValueError(f"row out of bounds: {row}")
    return list(ROWS[row])


def col_cell_indices(col: int) -> list[int]:
    if col < 0 or col >= GRID_SIDE:
        raise ValueError(f"col out of bounds: {col}")
    return list(COLS[col])


def peer_indices(index: int) -> frozenset[int]:
    if index < 0 or index >= CELL_COUNT:
        raise ValueError(f"cell index out of bounds: {index}")
    return PEERS[index]


def parse_grid(grid: str) -> list[int]:
    if len(grid) != CELL_COUNT:
        raise ValueError(f"grid must be {CELL_COUNT} characters, got {len(grid)}")
    values: list[int] = []
    for char in grid:
        if char < "0" or char > "9":
            raise ValueError(f"invalid grid character: {char!r}")
        values.append(ord(char) - ord("0"))
    return values


def format_grid(values: list[int]) -> str:
    if len(values) != CELL_COUNT:
        raise ValueError(f"grid values must have length {CELL_COUNT}, got {len(values)}")
    for value in values:
        if value < EMPTY_CELL or value > GRID_SIDE:
            raise ValueError(f"cell value out of range: {value}")
    return "".join(str(value) for value in values)
