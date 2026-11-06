#!/usr/bin/env python3
from __future__ import annotations

import argparse
import random
import time
from collections.abc import Callable
from functools import partial

from harvest_lesson_positions import SEED_PUZZLES

from app.services.sudoku.carver import carve_puzzle
from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.puzzle import generate_puzzle
from app.services.sudoku.solver import count_solutions
from app.services.sudoku.technique_solver import ALL_TECHNIQUES, solve_with_techniques

# Same order as harvest_lesson_positions.SEED_PUZZLES.
_SEED_LABELS = (
    "known",
    "singles",
    "medium",
    "shallow_medium",
    "hard_xy_wing",
    "shallow_hard",
)

# HARD in the engine benchmark: the xy-wing puzzle, harvest seed 4.
_HARD_PUZZLE = "300000000000354000765190000204000100010200705000001006920000000000067300073800014"

_GENERATE_ATTEMPTS = 80
_GENERATE_SECONDS = 900.0


def _require_seed_puzzles() -> tuple[str, ...]:
    if len(SEED_PUZZLES) != len(_SEED_LABELS):
        raise RuntimeError(f"expected {len(_SEED_LABELS)} seed puzzles, found {len(SEED_PUZZLES)}")
    if SEED_PUZZLES[4] != _HARD_PUZZLE:
        raise RuntimeError("seed puzzle 4 is not the hard xy-wing puzzle")
    for puzzle in SEED_PUZZLES:
        if len(puzzle) != 81 or not puzzle.isdigit():
            raise RuntimeError("seed puzzle must be 81 digits")
    return SEED_PUZZLES


def _count_seed(puzzle: str) -> int:
    return count_solutions(puzzle, limit=2)


def _timed_complete_grid() -> str:
    return generate_complete_grid(random.Random(3))


def _carve_seed(grid: str, min_givens: int) -> str:
    return carve_puzzle(grid, random.Random(5), min_givens=min_givens)


def _solve_hard() -> object:
    return solve_with_techniques(_HARD_PUZZLE, ALL_TECHNIQUES)


def _generate_seed(difficulty: Difficulty, seed: int) -> None:
    generate_puzzle(
        difficulty,
        rng=random.Random(seed),
        max_attempts=_GENERATE_ATTEMPTS,
        max_generate_seconds=_GENERATE_SECONDS,
    )


def _operations(with_generation: bool) -> list[tuple[str, Callable[[], object]]]:
    puzzles = _require_seed_puzzles()
    grid = _timed_complete_grid()
    operations: list[tuple[str, Callable[[], object]]] = [
        (f"count_solutions {label}", partial(_count_seed, puzzle))
        for label, puzzle in zip(_SEED_LABELS, puzzles, strict=True)
    ]
    operations.append(("generate_complete_grid", _timed_complete_grid))
    operations.extend(
        (f"carve_puzzle min_givens={min_givens}", partial(_carve_seed, grid, min_givens))
        for min_givens in (30, 24, 18)
    )
    operations.append(("solve_with_techniques hard", _solve_hard))
    operations.append(("generate_puzzle easy", partial(_generate_seed, Difficulty.easy, 7)))
    if with_generation:
        operations.append(("generate_puzzle medium", partial(_generate_seed, Difficulty.medium, 7)))
        operations.append(("generate_puzzle hard", partial(_generate_seed, Difficulty.hard, 1)))
    return operations


def _mean_ms(operation: Callable[[], object], runs: int) -> float:
    if runs < 1:
        raise ValueError("runs must be at least 1")
    elapsed = 0.0
    for _ in range(runs):
        started = time.perf_counter()
        operation()
        elapsed += time.perf_counter() - started
    return elapsed / runs * 1000


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark the sudoku engine")
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument(
        "--with-generation",
        action="store_true",
        help="also time generate_puzzle for medium and hard",
    )
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("runs must be at least 1")

    operations = _operations(args.with_generation)
    width = max(len("operation"), *(len(name) for name, _ in operations))
    print(f"{'operation':<{width}}  {'runs':>4}  {'mean_ms':>10}", flush=True)
    for name, operation in operations:
        mean_ms = _mean_ms(operation, args.runs)
        print(f"{name:<{width}}  {args.runs:>4}  {mean_ms:10.1f}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
