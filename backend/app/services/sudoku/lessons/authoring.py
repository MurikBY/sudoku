import json
from collections.abc import Iterator
from pathlib import Path
from random import Random

from app.services.sudoku.candidates import initial_candidates, place_digit
from app.services.sudoku.coach_step import (
    LocatedTechniqueStep,
    candidates_after_step,
    find_next_notes_issue,
    locate_next_technique_step,
)
from app.services.sudoku.grid import (
    EMPTY_CELL,
    cell_index,
    format_grid,
    parse_grid,
    row_col,
)
from app.services.sudoku.lessons.models import (
    LESSON_POOL_SIZE,
    PENCIL_LESSON,
    LessonPosition,
    NotesIssuePayload,
    TechniqueStepPayload,
)
from app.services.sudoku.lessons.role import LessonRole
from app.services.sudoku.lessons.store import LESSONS_DIR, load_pool, require_pool_shape
from app.services.sudoku.solver import count_solutions, solve
from app.services.sudoku.technique import EASY_TECHNIQUES


def write_lesson_pool(technique: str, positions: list[LessonPosition]) -> Path:
    require_pool_shape(technique, positions)
    for position in positions:
        validate_lesson_position(position)
    LESSONS_DIR.mkdir(parents=True, exist_ok=True)
    path = LESSONS_DIR / f"{technique}.json"
    payload = json.dumps(
        [position.model_dump(mode="json") for position in positions],
        indent=2,
    )
    path.write_text(payload + "\n")
    load_pool.cache_clear()
    return path


def assign_pool(technique: str, snapshots: list[LessonPosition]) -> list[LessonPosition]:
    if len(snapshots) != LESSON_POOL_SIZE:
        raise ValueError(
            f"{technique} needs {LESSON_POOL_SIZE} snapshots, got {len(snapshots)}",
        )
    ordered = sorted(snapshots, key=_clarity_rank)
    assigned: list[LessonPosition] = []
    for index, snapshot in enumerate(ordered):
        if snapshot.technique != technique:
            raise ValueError(
                f"snapshot technique {snapshot.technique} does not match pool {technique}",
            )
        assigned.append(
            LessonPosition(
                id=f"{technique}-{index + 1:02d}",
                technique=technique,
                role=LessonRole.taught if index == 0 else LessonRole.practice,
                puzzle=snapshot.puzzle,
                solution=snapshot.solution,
                grid=snapshot.grid,
                notes=snapshot.notes,
                step=snapshot.step,
                notes_issue=snapshot.notes_issue,
            ),
        )
    return assigned


def validate_lesson_position(position: LessonPosition) -> None:
    _validate_grids(position)
    if position.technique == PENCIL_LESSON:
        _validate_pencil(position)
        return
    issue = find_next_notes_issue(position.grid, position.notes)
    if issue is not None:
        raise ValueError(f"{position.id}: expected no notes issue, got {issue.kind.value}")
    located = locate_next_technique_step(position.grid, position.notes)
    if located is None:
        raise ValueError(f"{position.id}: no technique step on board")
    if located.step.technique.value != position.technique:
        raise ValueError(
            f"{position.id}: next step is {located.step.technique.value}, "
            f"expected {position.technique}",
        )
    if position.step != TechniqueStepPayload.from_step(located.step):
        raise ValueError(f"{position.id}: stored step does not match live step")


def iter_technique_snapshots(puzzle: str, solution: str) -> Iterator[LessonPosition]:
    grid = puzzle
    notes: dict[str, list[int]] = {}
    seen_steps: set[tuple[str, str]] = set()
    seen_states: set[tuple[str, tuple[tuple[str, tuple[int, ...]], ...]]] = set()
    steps = 0
    while True:
        steps += 1
        if steps > 120:
            return
        state = (grid, _notes_state(notes))
        if state in seen_states:
            raise ValueError("technique walk did not advance")
        seen_states.add(state)
        located = locate_next_technique_step(grid, notes)
        if located is None:
            return
        step_notes = notes_from_candidates(parse_grid(grid), located.candidates)
        key = (located.step.technique.value, grid)
        if key not in seen_steps:
            seen_steps.add(key)
            yield LessonPosition(
                id="",
                technique=located.step.technique.value,
                role=LessonRole.practice,
                puzzle=puzzle,
                solution=solution,
                grid=grid,
                notes=step_notes,
                step=TechniqueStepPayload.from_step(located.step),
                notes_issue=None,
            )
        grid, notes = board_after_step(grid, located)


def pencil_snapshot(puzzle: str, solution: str, grid: str) -> LessonPosition:
    values = parse_grid(grid)
    candidates = initial_candidates(values)
    blank_issue = find_next_notes_issue(grid, {})
    if blank_issue is None:
        raise ValueError("pencil snapshot needs a notes issue on an empty-notes board")
    if blank_issue.kind.value not in {"empty", "incomplete"}:
        raise ValueError(
            f"pencil snapshot has {blank_issue.kind.value}, expected empty or incomplete",
        )
    notes = notes_from_candidates(values, candidates)
    target_key = str(blank_issue.cell_index)
    if target_key not in notes:
        raise ValueError(f"pencil snapshot target {target_key} is not an empty cell")
    del notes[target_key]
    issue = find_next_notes_issue(grid, notes)
    if issue is None:
        raise ValueError("pencil snapshot lost the notes issue after filling other cells")
    if issue.cell_index != blank_issue.cell_index:
        raise ValueError("pencil snapshot empty-notes cell shifted after filling")
    if issue.kind.value not in {"empty", "incomplete"}:
        raise ValueError(f"pencil snapshot notes issue is {issue.kind.value}")
    return LessonPosition(
        id="",
        technique=PENCIL_LESSON,
        role=LessonRole.practice,
        puzzle=puzzle,
        solution=solution,
        grid=grid,
        notes=notes,
        step=None,
        notes_issue=NotesIssuePayload.from_issue(issue),
    )


def notes_from_candidates(values: list[int], candidates: list[set[int]]) -> dict[str, list[int]]:
    notes: dict[str, list[int]] = {}
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        digits = sorted(candidates[index])
        if not digits:
            raise ValueError(f"empty candidates at cell {index}")
        notes[str(index)] = digits
    return notes


def board_after_step(grid: str, located: LocatedTechniqueStep) -> tuple[str, dict[str, list[int]]]:
    values = parse_grid(grid)
    candidates = [set(cell_candidates) for cell_candidates in located.candidates]
    step = located.step
    if step.technique in EASY_TECHNIQUES:
        place_digit(values, candidates, step.focus_cells[0], step.digit_value)
        return format_grid(values), notes_from_candidates(values, candidates)
    after = candidates_after_step(step, values, candidates)
    return grid, notes_from_candidates(values, after)


def expand_lesson_pool(
    snapshots: list[LessonPosition],
    rng: Random,
    pool_size: int = LESSON_POOL_SIZE,
) -> list[LessonPosition]:
    if not snapshots:
        raise ValueError("cannot expand an empty lesson pool")
    unique: list[LessonPosition] = []
    seen: set[str] = set()
    for snapshot in snapshots:
        if snapshot.grid in seen:
            continue
        seen.add(snapshot.grid)
        unique.append(snapshot)
    attempts = 0
    while len(unique) < pool_size and attempts < 4000:
        attempts += 1
        source = snapshots[rng.randrange(len(snapshots))]
        try:
            variant = symmetrize_lesson(source, rng)
            validate_lesson_position(variant)
        except ValueError:
            continue
        if variant.grid in seen:
            continue
        seen.add(variant.grid)
        unique.append(variant)
    if len(unique) < pool_size:
        raise ValueError(
            f"could not expand {snapshots[0].technique} to {pool_size}, got {len(unique)}",
        )
    return unique[:pool_size]


def symmetrize_lesson(position: LessonPosition, rng: Random) -> LessonPosition:
    digit_map = _shuffled_digits(rng)
    row_map = _shuffle_bands(rng)
    col_map = _shuffle_bands(rng)
    transpose = bool(rng.randrange(2))
    puzzle = _map_grid(position.puzzle, digit_map, row_map, col_map, transpose)
    solution = _map_grid(position.solution, digit_map, row_map, col_map, transpose)
    grid = _map_grid(position.grid, digit_map, row_map, col_map, transpose)
    notes = _map_notes(position.notes, digit_map, row_map, col_map, transpose)
    if position.technique == PENCIL_LESSON:
        return pencil_snapshot(puzzle, solution, grid)
    located = locate_next_technique_step(grid, notes)
    if located is None or located.step.technique.value != position.technique:
        raise ValueError("symmetry lost the lesson technique")
    return LessonPosition(
        id="",
        technique=position.technique,
        role=LessonRole.practice,
        puzzle=puzzle,
        solution=solution,
        grid=grid,
        notes=notes,
        step=TechniqueStepPayload.from_step(located.step),
        notes_issue=None,
    )


def require_unique_solution(puzzle: str, solution: str) -> None:
    if count_solutions(puzzle, limit=2) != 1:
        raise ValueError("puzzle is not uniquely solvable")
    solved = solve(puzzle)
    if solved is None:
        raise ValueError("puzzle has no solution")
    if solved != solution:
        raise ValueError("solution does not match unique solve")


def _shuffled_digits(rng: Random) -> dict[int, int]:
    digits = list(range(1, 10))
    rng.shuffle(digits)
    return {source: digits[source - 1] for source in range(1, 10)}


def _shuffle_bands(rng: Random) -> list[int]:
    bands = [list(range(start, start + 3)) for start in (0, 3, 6)]
    rng.shuffle(bands)
    mapping = [0] * 9
    new_index = 0
    for band in bands:
        rng.shuffle(band)
        for old_index in band:
            mapping[old_index] = new_index
            new_index += 1
    return mapping


def _map_grid(
    grid: str,
    digit_map: dict[int, int],
    row_map: list[int],
    col_map: list[int],
    transpose: bool,
) -> str:
    mapped = ["0"] * 81
    for index, character in enumerate(grid):
        new_index = _map_cell_index(index, row_map, col_map, transpose)
        if character == "0":
            mapped[new_index] = "0"
            continue
        mapped[new_index] = str(digit_map[int(character)])
    return "".join(mapped)


def _map_notes(
    notes: dict[str, list[int]],
    digit_map: dict[int, int],
    row_map: list[int],
    col_map: list[int],
    transpose: bool,
) -> dict[str, list[int]]:
    mapped: dict[str, list[int]] = {}
    for key, digits in notes.items():
        new_index = _map_cell_index(int(key), row_map, col_map, transpose)
        mapped[str(new_index)] = sorted(digit_map[digit] for digit in digits)
    return mapped


def _map_cell_index(
    index: int,
    row_map: list[int],
    col_map: list[int],
    transpose: bool,
) -> int:
    row, col = row_col(index)
    row = row_map[row]
    col = col_map[col]
    if transpose:
        row, col = col, row
    return cell_index(row, col)


def _validate_grids(position: LessonPosition) -> None:
    require_unique_solution(position.puzzle, position.solution)
    for index, (puzzle_digit, grid_digit, solution_digit) in enumerate(
        zip(position.puzzle, position.grid, position.solution, strict=True),
    ):
        if puzzle_digit not in ("0", grid_digit):
            raise ValueError(f"{position.id}: puzzle given changed at cell {index}")
        if grid_digit not in ("0", solution_digit):
            raise ValueError(f"{position.id}: grid disagrees with solution at cell {index}")
        if puzzle_digit not in ("0", solution_digit):
            raise ValueError(f"{position.id}: puzzle disagrees with solution at cell {index}")


def _validate_pencil(position: LessonPosition) -> None:
    issue = find_next_notes_issue(position.grid, position.notes)
    if issue is None:
        raise ValueError(f"{position.id}: pencil lesson has no notes issue")
    if issue.kind.value not in {"empty", "incomplete"}:
        raise ValueError(f"{position.id}: pencil lesson notes issue is {issue.kind.value}")
    if position.notes_issue != NotesIssuePayload.from_issue(issue):
        raise ValueError(f"{position.id}: stored notes issue does not match live issue")
    values = parse_grid(position.grid)
    empty_without_notes = [
        index
        for index, value in enumerate(values)
        if value == EMPTY_CELL and not position.notes.get(str(index), [])
    ]
    if empty_without_notes != [issue.cell_index]:
        raise ValueError(
            f"{position.id}: pencil lesson must leave notes empty only at the issue cell, "
            f"got {empty_without_notes}",
        )


def _clarity_rank(position: LessonPosition) -> tuple[int, int]:
    empty_cells = position.grid.count("0")
    note_marks = sum(len(digits) for digits in position.notes.values())
    return empty_cells, note_marks


def _notes_state(notes: dict[str, list[int]]) -> tuple[tuple[str, tuple[int, ...]], ...]:
    return tuple(sorted((key, tuple(digits)) for key, digits in notes.items()))
