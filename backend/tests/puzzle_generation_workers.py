import os

from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.generation_worker import GenerationFailed
from app.services.sudoku.grid import CELL_COUNT
from app.services.sudoku.puzzle import GeneratedPuzzle

CRASH_MARKER_ENV = "PUZZLE_GENERATION_CRASH_MARKER"


def crash_on_first_call(difficulty: Difficulty) -> GeneratedPuzzle:
    marker_path = os.environ[CRASH_MARKER_ENV]
    if os.path.exists(marker_path):
        return _puzzle(difficulty, givens_count=0)
    with open(marker_path, "w", encoding="utf-8") as marker_file:
        marker_file.write("1")
    os._exit(1)


def raise_generation_failed(_difficulty: Difficulty) -> GeneratedPuzzle:
    raise GenerationFailed("x")


def report_niceness(difficulty: Difficulty) -> GeneratedPuzzle:
    return _puzzle(difficulty, givens_count=os.nice(0))


def _puzzle(difficulty: Difficulty, givens_count: int) -> GeneratedPuzzle:
    empty_grid = "0" * CELL_COUNT
    return GeneratedPuzzle(
        puzzle=empty_grid,
        solution=empty_grid,
        difficulty=difficulty,
        givens_count=givens_count,
    )
