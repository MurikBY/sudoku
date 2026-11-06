from app.services.sudoku.grid import EMPTY_CELL, format_grid, parse_grid, peer_indices


def is_valid_placement(values: list[int], index: int, value: int) -> bool:
    if value < 1 or value > 9:
        return False
    return all(values[peer_index] != value for peer_index in peer_indices(index))


def solve(grid: str) -> str | None:
    values = parse_grid(grid)
    if _solve_values(values):
        return format_grid(values)
    return None


def count_solutions(grid: str, limit: int = 2) -> int:
    if limit < 1:
        raise ValueError("limit must be at least 1")
    values = parse_grid(grid)
    return _count_values(values, limit)


def _find_most_constrained_empty_index(values: list[int]) -> int | None:
    best_index: int | None = None
    best_candidate_count = 10
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        candidate_count = 0
        for digit in range(1, 10):
            if is_valid_placement(values, index, digit):
                candidate_count += 1
                if candidate_count >= best_candidate_count:
                    break
        if candidate_count == 0:
            return index
        if candidate_count < best_candidate_count:
            best_candidate_count = candidate_count
            best_index = index
    return best_index


def _solve_values(values: list[int]) -> bool:
    empty_index = _find_most_constrained_empty_index(values)
    if empty_index is None:
        return True

    for digit in range(1, 10):
        if not is_valid_placement(values, empty_index, digit):
            continue
        values[empty_index] = digit
        if _solve_values(values):
            return True
        values[empty_index] = EMPTY_CELL
    return False


def _count_values(values: list[int], limit: int) -> int:
    empty_index = _find_most_constrained_empty_index(values)
    if empty_index is None:
        return 1

    total = 0
    for digit in range(1, 10):
        if not is_valid_placement(values, empty_index, digit):
            continue
        values[empty_index] = digit
        total += _count_values(values, limit - total)
        values[empty_index] = EMPTY_CELL
        if total >= limit:
            return limit
    return total
