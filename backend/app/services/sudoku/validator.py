from app.services.sudoku.grid import (
    CELL_COUNT,
    EMPTY_CELL,
    GRID_SIDE,
    HOUSES,
    parse_grid,
)


def conflict_indices(grid: str) -> frozenset[int]:
    values = parse_grid(grid)
    conflicts: set[int] = set()
    for house in HOUSES:
        for digit in range(1, GRID_SIDE + 1):
            matching_indices = [index for index in house.cells if values[index] == digit]
            if len(matching_indices) > 1:
                conflicts.update(matching_indices)
    return frozenset(conflicts)


def has_conflicts(grid: str) -> bool:
    return bool(conflict_indices(grid))


def is_complete(grid: str) -> bool:
    values = parse_grid(grid)
    if any(value == EMPTY_CELL for value in values):
        return False
    return not has_conflicts(grid)


def matches_solution(player_grid: str, solution: str) -> bool:
    parse_grid(solution)
    return is_complete(player_grid) and player_grid == solution


def validate_player_grid(puzzle: str, player_grid: str) -> None:
    puzzle_values = parse_grid(puzzle)
    player_values = parse_grid(player_grid)
    for index, given in enumerate(puzzle_values):
        if given == EMPTY_CELL:
            continue
        if player_values[index] != given:
            raise ValueError(f"given cell {index} was modified")


def validate_move(puzzle: str, player_grid: str, index: int, value: int) -> None:
    if index < 0 or index >= CELL_COUNT:
        raise ValueError(f"cell index out of bounds: {index}")
    if value < EMPTY_CELL or value > GRID_SIDE:
        raise ValueError(f"cell value out of range: {value}")

    validate_player_grid(puzzle, player_grid)
    puzzle_values = parse_grid(puzzle)
    if puzzle_values[index] != EMPTY_CELL:
        raise ValueError("cannot modify given cell")


def wrong_digit_indices(player_grid: str, puzzle: str, solution: str) -> frozenset[int]:
    puzzle_values = parse_grid(puzzle)
    player_values = parse_grid(player_grid)
    solution_values = parse_grid(solution)
    wrong: set[int] = set()
    for index, given in enumerate(puzzle_values):
        if given != EMPTY_CELL:
            continue
        player_value = player_values[index]
        if player_value != EMPTY_CELL and player_value != solution_values[index]:
            wrong.add(index)
    return frozenset(wrong)


def is_move_mistake(index: int, value: int, solution: str) -> bool:
    if value == EMPTY_CELL:
        return False
    solution_values = parse_grid(solution)
    return value != solution_values[index]


def is_correct_player_digit(
    puzzle: str,
    player_grid: str,
    solution: str,
    index: int,
) -> bool:
    puzzle_values = parse_grid(puzzle)
    if puzzle_values[index] != EMPTY_CELL:
        return False
    player_values = parse_grid(player_grid)
    player_value = player_values[index]
    if player_value == EMPTY_CELL:
        return False
    solution_values = parse_grid(solution)
    return player_value == solution_values[index]
