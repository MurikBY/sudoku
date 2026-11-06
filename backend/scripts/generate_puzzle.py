#!/usr/bin/env python3
import argparse
import random

from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.puzzle import generate_puzzle


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a rated Sudoku puzzle")
    parser.add_argument("difficulty", choices=[member.value for member in Difficulty])
    parser.add_argument("--seed", type=int, help="RNG seed for reproducible output")
    parser.add_argument(
        "--max-attempts",
        type=int,
        default=100,
        help="maximum generation attempts before failing",
    )
    args = parser.parse_args()

    rng = random.Random(args.seed) if args.seed is not None else None
    generated = generate_puzzle(
        Difficulty(args.difficulty),
        rng=rng,
        max_attempts=args.max_attempts,
    )

    print(f"difficulty: {generated.difficulty}")
    print(f"givens: {generated.givens_count}")
    print(f"puzzle: {generated.puzzle}")
    print(f"solution: {generated.solution}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
