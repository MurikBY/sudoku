import pytest

from app.services.sudoku.grid import (
    BOX_SIDE,
    CELL_COUNT,
    GRID_SIDE,
    box_cell_indices,
    box_index,
    box_origin,
    cell_index,
    col_cell_indices,
    format_grid,
    parse_grid,
    peer_indices,
    row_cell_indices,
    row_col,
)


def test_cell_index_and_row_col_roundtrip():
    for row in range(GRID_SIDE):
        for col in range(GRID_SIDE):
            index = cell_index(row, col)
            assert row_col(index) == (row, col)


def test_box_index_maps_3x3_regions():
    assert box_index(0, 0) == 0
    assert box_index(0, 3) == 1
    assert box_index(3, 0) == 3
    assert box_index(8, 8) == 8


def test_box_origin_and_box_cells_cover_nine_indices():
    for box in range(GRID_SIDE):
        box_row, box_col = box_origin(box)
        assert box_row % BOX_SIDE == 0
        assert box_col % BOX_SIDE == 0
        indices = box_cell_indices(box)
        assert len(indices) == 9
        assert len(set(indices)) == 9


def test_row_and_col_indices():
    assert row_cell_indices(0) == list(range(9))
    assert col_cell_indices(0) == [0, 9, 18, 27, 36, 45, 54, 63, 72]


def test_peer_indices_exclude_self_and_include_row_col_box():
    index = cell_index(4, 4)
    peers = peer_indices(index)
    assert index not in peers
    assert len(peers) == 20
    assert cell_index(4, 0) in peers
    assert cell_index(0, 4) in peers
    assert cell_index(3, 3) in peers


def test_parse_grid_accepts_zeros_and_digits():
    values = parse_grid("0" * CELL_COUNT)
    assert values == [0] * CELL_COUNT
    assert format_grid(values) == "0" * CELL_COUNT


def test_parse_grid_rejects_wrong_length():
    with pytest.raises(ValueError, match="81"):
        parse_grid("123")


def test_parse_grid_rejects_invalid_characters():
    with pytest.raises(ValueError, match="invalid grid character"):
        parse_grid("a" + "0" * (CELL_COUNT - 1))


def test_format_grid_rejects_out_of_range_values():
    with pytest.raises(ValueError, match="out of range"):
        format_grid([10] + [0] * (CELL_COUNT - 1))


def test_cell_index_rejects_out_of_bounds():
    with pytest.raises(ValueError, match="out of bounds"):
        cell_index(9, 0)
