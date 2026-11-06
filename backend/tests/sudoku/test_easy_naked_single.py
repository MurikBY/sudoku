import random
import time

import pytest

from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.grid import CELL_COUNT, EMPTY_CELL, cell_index, format_grid, parse_grid
from app.services.sudoku.puzzle import (
    GENERATION_PROFILES,
    DeepenContext,
    GenerateSearchStats,
    accept_or_deepen,
)
from app.services.sudoku.technique_solver import (
    easy_path_forces_hard_naked_single,
    first_hidden_single,
    naked_single_is_obvious,
    naked_single_placements,
    position_forces_hard_naked_single,
)
from tests.fixtures import KNOWN_SOLUTION

_FILLED = 1


def _board(empty_candidates: dict[int, set[int]]) -> tuple[list[int], list[set[int]]]:
    values = [_FILLED] * CELL_COUNT
    candidates: list[set[int]] = [set() for _ in range(CELL_COUNT)]
    for index, cell_candidates in empty_candidates.items():
        values[index] = EMPTY_CELL
        candidates[index] = set(cell_candidates)
    return values, candidates


def _cells(rows: range, cols: range) -> list[int]:
    return [cell_index(row, col) for row in rows for col in cols]


def _hard_naked_board(row_seven_cols: tuple[int, ...]) -> tuple[list[int], list[set[int]]]:
    # 3x3 of digit 7: each row, column, and the box has 3 empties, so none is obvious.
    # Extra {1,2} cells sit in pairs inside each house so they are not hidden singles.
    assigned = {index: {7} for index in _cells(range(3), range(3))}
    for index in _cells(range(4, 6), range(3, 9)):
        assigned[index] = {1, 2}
    for col in row_seven_cols:
        assigned[cell_index(7, col)] = {1, 2}
    return _board(assigned)


def _assert_only_hard_naked_singles(values: list[int], candidates: list[set[int]]) -> None:
    assert first_hidden_single(values, candidates) is None
    naked_singles = naked_single_placements(values, candidates)
    assert naked_singles
    assert not any(naked_single_is_obvious(values, index) for index, _digit in naked_singles)


def test_hard_naked_single_above_empty_limit_is_rejected():
    values, candidates = _hard_naked_board((3, 4, 6, 7))
    assert sum(value == EMPTY_CELL for value in values) == 25
    _assert_only_hard_naked_singles(values, candidates)
    assert position_forces_hard_naked_single(values, candidates) is True


def test_hard_naked_single_at_empty_limit_is_kept():
    values, candidates = _hard_naked_board((3, 4, 5))
    assert sum(value == EMPTY_CELL for value in values) == 24
    _assert_only_hard_naked_singles(values, candidates)
    assert position_forces_hard_naked_single(values, candidates) is False


def test_hard_naked_single_under_empty_limit_is_kept():
    values, candidates = _hard_naked_board((3, 4))
    assert sum(value == EMPTY_CELL for value in values) == 23
    _assert_only_hard_naked_singles(values, candidates)
    assert position_forces_hard_naked_single(values, candidates) is False


def test_hidden_single_keeps_a_board_above_the_empty_limit():
    values, candidates = _hard_naked_board((3, 4, 6, 7))
    _assert_only_hard_naked_singles(values, candidates)
    candidates[cell_index(4, 3)].add(3)
    assert first_hidden_single(values, candidates) == (cell_index(4, 3), 3)
    assert position_forces_hard_naked_single(values, candidates) is False


def test_obvious_naked_single_keeps_a_board_with_many_empties():
    assigned = {index: {7} for index in _cells(range(2), range(2))}
    for index in _cells(range(3, 7), range(9)):
        assigned[index] = {1, 2}
    values, candidates = _board(assigned)
    assert sum(value == EMPTY_CELL for value in values) == 40
    assert first_hidden_single(values, candidates) is None
    naked_singles = naked_single_placements(values, candidates)
    assert naked_singles
    assert all(naked_single_is_obvious(values, index) for index, _digit in naked_singles)
    assert position_forces_hard_naked_single(values, candidates) is False


def test_solved_grid_does_not_force_a_hard_naked_single():
    assert easy_path_forces_hard_naked_single(KNOWN_SOLUTION) is False


def test_easy_path_raises_when_no_single_can_be_placed():
    values = parse_grid(KNOWN_SOLUTION)
    for index in _cells(range(9), range(3, 6)):
        values[index] = EMPTY_CELL
    with pytest.raises(RuntimeError, match="easy puzzle cannot place a single"):
        easy_path_forces_hard_naked_single(format_grid(values))


def _easy_deepen_context(stats: GenerateSearchStats, deadline: float) -> DeepenContext:
    return DeepenContext(
        difficulty=Difficulty.easy,
        rng=random.Random(0),
        deadline=deadline,
        stats=stats,
        profile=GENERATION_PROFILES[Difficulty.easy],
    )


def test_easy_accept_skips_a_forced_hard_naked_single(monkeypatch):
    deadline = time.monotonic() + 5
    accepted = accept_or_deepen(
        KNOWN_SOLUTION,
        KNOWN_SOLUTION,
        _easy_deepen_context(GenerateSearchStats(), deadline),
    )
    assert accepted is not None

    monkeypatch.setattr(
        "app.services.sudoku.puzzle.easy_path_forces_hard_naked_single",
        lambda _puzzle: True,
    )
    rejected = accept_or_deepen(
        KNOWN_SOLUTION,
        KNOWN_SOLUTION,
        _easy_deepen_context(GenerateSearchStats(), deadline),
    )
    assert rejected is None
