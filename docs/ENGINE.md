# Engine

The grid engine lives in `services/sudoku/`. A puzzle is an 81-character string, row by row. `0` is an empty cell. Cells are indexes `0` through `80`. `PEERS` is computed once: for each cell, the other cells in its row, column, and box.

## Grid and the solver

`solver.py` keeps one bitmask per row, column, and box. Bit `d` is digit `d`, so bits 1 through 9 are the nine digits. A placement flips that bit in the three units. The search picks the empty cell with the fewest candidates, which is the minimum-remaining-values rule, and tries those bits. `count_solutions` stops at its limit. Callers pass `limit=2` and treat a count of 1 as a unique solution. A grid that already repeats a digit in a unit counts as zero solutions, and `solve` returns `None`.

## Technique scans

Each technique is one iterator in `technique_steps.py`, registered in `technique_registry.py`. `apply_scan` runs that iterator to the end, places or eliminates every step it yields, and `solve_with_techniques` counts the scan as one step. The coach calls `first_step_of` and explains that first step only.

The scan order is naked single, hidden single, naked pair, hidden pair, pointing pair, box/line reduction, X-Wing, swordfish, XY-Wing, XYZ-Wing. Easy is the two singles. Medium adds the pairs and the two reductions. Hard is the four wing and fish techniques.

## Grade

`grade_from_result` is the weight of the hardest technique, plus a bonus for how many medium and hard scans the path took, plus a tail for a long path:

```text
weight(hardest)
+ 0.35 * hard_step_count
+ 0.08 * medium_step_count
+ 0.5 * max(0, total_step_count - 15) / 40
```

A path with no technique uses the naked-single weight.

| Technique | Weight |
|---|---|
| Naked single | 1.0 |
| Hidden single | 1.15 |
| Naked pair | 1.5 |
| Hidden pair | 1.7 |
| Pointing pair | 1.9 |
| Box/line reduction | 1.9 |
| X-Wing | 2.5 |
| Swordfish | 3.2 |
| XY-Wing | 3.4 |
| XYZ-Wing | 3.6 |

`HARD_STEP_GRADE_BONUS` is `0.35`, added once per hard scan. `MEDIUM_STEP_GRADE_BONUS` is `0.08`, added once per medium scan. `TOTAL_STEP_OFFSET` is `15` and `TOTAL_STEP_SCALE` is `40`: steps past the fifteenth add length, and `TOTAL_STEP_GRADE_BONUS` is `0.5`, the weight of that tail.

`GRADE_MEDIUM_MIN` is `1.95`. The pointing-pair weight alone is 1.9, which stays under it. That ceiling plus one medium scan is about 1.98. `GRADE_HARD_MIN` is `4.0`. One hard scan adds its weight plus 0.35: 2.85 for an X-Wing and 3.95 for an XYZ-Wing, still under 4.0 before any other bonus.

`rate_difficulty` requires the technique band as well as the grade. A hard technique under 4.0 raises. A medium technique under 1.95 raises. Anything else is easy. Generation uses the same cuts in `matches_target_difficulty`: hard needs a hard technique and a grade of at least 4.0, medium needs a medium technique, no hard technique, and a grade of at least 1.95, and easy needs neither.

## Generation

`generate_puzzle` fills a complete grid, carves givens, then calls `accept_or_deepen`. Carving removes clues while `count_solutions` stays at 1, and stops at the carve target. A probe removes one more given, keeps the puzzle only when it is still unique, and rates it. Easy does not probe. Medium and hard probe when the grade is short of the target. A probe that enters the hard zone is discarded. Medium aborts a dig after five such probes in a row.

| Difficulty | Carve target | Givens floor | Digs per grid | Probes per round | Rounds | Time budget |
|---|---|---|---|---|---|---|
| Easy | 30 | 30 | 1 | 0 | 0 | 60 s |
| Medium | 30 | 24 | 24 | 10 | 6 | 180 s |
| Hard | 18 | 18 | 24 | 15 | 8 | 300 s |

The outer loop tries at most 200 grids. Past the time budget or that cap, `generate_puzzle` raises `RuntimeError`. The refill worker turns that into `PuzzleGenerationFailed`. `refill_one` tries three times and then raises. `ensure_stock` logs the failure and stops refilling that difficulty for the current pass. The player does not see this error.

A hard puzzle that medium techniques already solve is rejected before the full grade. An easy puzzle whose path forces a hard naked single is rejected too.

## Puzzle pool

`puzzle_pool` holds ready puzzles, one row per generated puzzle. Starting a game or a party deletes the oldest row of the requested difficulty and copies it. A lesson and an analysis do not use the pool. The pool is kept at `PUZZLE_POOL_TARGET_SIZE` (50). The refill loop wakes every `PUZZLE_POOL_REFILL_INTERVAL_SECONDS` (30), and a take schedules the same refill. One worker process, started with `nice` 10, runs `generate_puzzle`. The API process does not.

An empty difficulty answers HTTP 503 with "No puzzles ready for this difficulty. Try again in a couple of minutes." The client shows that sentence. The take still schedules a refill.

## Benchmark

`scripts/benchmark_engine.py --with-generation` times five runs and prints the mean. This run is on the serving host (2 vCPU, AMD EPYC-Rome), 2 Nov 2026:

| Operation | Mean |
|---|---|
| `count_solutions` known | 0.1 ms |
| `count_solutions` singles | 0.4 ms |
| `count_solutions` medium | 9.8 ms |
| `count_solutions` shallow medium | 0.7 ms |
| `count_solutions` hard XY-Wing | 3.0 ms |
| `count_solutions` shallow hard | 7.9 ms |
| `generate_complete_grid` | 1.2 ms |
| `carve_puzzle` at 30 givens | 15.9 ms |
| `carve_puzzle` at 24 givens | 39.1 ms |
| `carve_puzzle` at 18 givens | 56.5 ms |
| `solve_with_techniques` hard | 12.1 ms |
| `generate_puzzle` easy | 26.2 ms |
| `generate_puzzle` medium | 904.6 ms |
| `generate_puzzle` hard | 1008.7 ms |

## Lessons

Each lesson technique has a pool of nine positions, and exactly one of them is the taught position. The objective is the stored step on the current grid and notes. It does not look at hints. A lesson passed with a hint does not count. The rules are in [LEARN.md](LEARN.md).
