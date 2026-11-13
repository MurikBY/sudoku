#!/usr/bin/env python3
from __future__ import annotations

import argparse
import random
import time

from app.services.sudoku.carver import carve_puzzle, givens_count
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.lessons.authoring import (
    assign_pool,
    expand_lesson_pool,
    iter_technique_snapshots,
    pencil_snapshot,
    write_lesson_pool,
)
from app.services.sudoku.lessons.models import (
    LESSON_POOL_SIZE,
    LESSON_TECHNIQUES,
    PENCIL_LESSON,
    LessonPosition,
)
from app.services.sudoku.solver import solve
from app.services.sudoku.technique_solver import EASY_TECHNIQUES

SEED_PUZZLES = (
    "000456789006789123000123456214365897365897214897214365531642978642978531978531642",
    "003020600900305001001806400008102900700000008006708200002609500800203009005010300",
    "270300590510000036000100820600000010000782059000000000080000000900043000060070000",
    "000002010086054000510090020000500000740080150009000000060070091000003074470000308",
    "300000000000354000765190000204000100010200705000001006920000000000067300073800014",
    "090200000200500007800619000000025800070800090001000003000030780700000200009002016",
)

_EASY_NAMES = frozenset(technique.value for technique in EASY_TECHNIQUES)
_HARVEST_UNIQUE_SOURCES = 2


def main() -> int:
    parser = argparse.ArgumentParser(description="Harvest shared lesson position pools")
    parser.add_argument("--max-seconds", type=float, default=3600.0)
    parser.add_argument("--seed", type=int, default=20260830)
    args = parser.parse_args()

    buckets: dict[str, list[LessonPosition]] = {name: [] for name in LESSON_TECHNIQUES}
    rng = random.Random(args.seed)
    for puzzle in SEED_PUZZLES:
        _collect_from_puzzle(puzzle, buckets)
        _print_counts(buckets)
    _collect_from_carved_puzzles(buckets, rng, time.monotonic() + args.max_seconds)
    _require_every_technique(buckets)
    _write_pools(buckets, rng)
    return 0


def _collect_from_carved_puzzles(
    buckets: dict[str, list[LessonPosition]],
    rng: random.Random,
    deadline: float,
) -> None:
    carved = 0
    while time.monotonic() < deadline:
        if all(buckets[name] for name in LESSON_TECHNIQUES):
            return
        solution = generate_complete_grid(rng)
        puzzle = carve_puzzle(solution, rng, min_givens=17)
        before = _missing(buckets)
        _collect_from_puzzle(puzzle, buckets, solution=solution)
        carved += 1
        after = _missing(buckets)
        if after != before or carved % 100 == 0:
            print(
                f"carved {carved} givens={givens_count(puzzle)} remaining={after}",
                flush=True,
            )
            _print_counts(buckets)


def _require_every_technique(buckets: dict[str, list[LessonPosition]]) -> None:
    missing = _missing(buckets)
    empty = {name: count for name, count in missing.items() if count == LESSON_POOL_SIZE}
    if empty:
        raise SystemExit(f"lesson harvest found no snapshots for: {sorted(empty)}")


def _write_pools(buckets: dict[str, list[LessonPosition]], rng: random.Random) -> None:
    print("expanding pools", flush=True)
    for technique, snapshots in buckets.items():
        print(f"expand {technique} from {len(snapshots)}", flush=True)
        filled = expand_lesson_pool(snapshots, rng)
        path = write_lesson_pool(technique, assign_pool(technique, filled))
        print(f"wrote {path} from {len(snapshots)} harvested")


def _collect_from_puzzle(
    puzzle: str,
    buckets: dict[str, list[LessonPosition]],
    solution: str | None = None,
) -> None:
    solved = solution if solution is not None else solve(puzzle)
    if solved is None:
        raise ValueError(f"puzzle has no solution: {puzzle}")
    try:
        snapshots = list(iter_technique_snapshots(puzzle, solved))
    except ValueError as error:
        print(f"skip puzzle walk: {error}", flush=True)
        return
    for snapshot in snapshots:
        _offer(buckets[snapshot.technique], snapshot)
        if snapshot.technique in _EASY_NAMES:
            continue
        try:
            _offer(
                buckets[PENCIL_LESSON],
                pencil_snapshot(puzzle, solved, snapshot.grid),
            )
        except ValueError:
            continue


def _offer(bucket: list[LessonPosition], snapshot: LessonPosition) -> None:
    if len(bucket) >= _HARVEST_UNIQUE_SOURCES:
        return
    if any(existing.grid == snapshot.grid for existing in bucket):
        return
    bucket.append(snapshot)


def _missing(buckets: dict[str, list[LessonPosition]]) -> dict[str, int]:
    return {
        name: LESSON_POOL_SIZE - len(bucket)
        for name, bucket in buckets.items()
        if len(bucket) < LESSON_POOL_SIZE
    }


def _print_counts(buckets: dict[str, list[LessonPosition]]) -> None:
    parts = [f"{name}={len(buckets[name])}/{LESSON_POOL_SIZE}" for name in LESSON_TECHNIQUES]
    print("pool " + " ".join(parts), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
