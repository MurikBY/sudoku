import logging
import random
import time
from dataclasses import dataclass
from enum import StrEnum

from app.services.sudoku.carver import carve_puzzle, givens_count
from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.grader import grade_from_result
from app.services.sudoku.rater import (
    matches_target_difficulty,
    rate_puzzle,
    uses_medium_technique,
)
from app.services.sudoku.solver import count_solutions
from app.services.sudoku.technique_solver import (
    MEDIUM_TECHNIQUES,
    TechniqueSolveResult,
    easy_path_forces_hard_naked_single,
    solve_with_techniques,
)

logger = logging.getLogger(__name__)

DEFAULT_MAX_ATTEMPTS = 200

# Medium: bail out of a dig after this many consecutive hard-zone deepen probes.
_MEDIUM_HARD_ZONE_STREAK_ABORT = 5


@dataclass(frozen=True)
class GenerationProfile:
    carve_givens: int
    min_givens: int
    digs_per_grid: int
    probes_per_round: int
    rounds: int
    time_budget_seconds: float


GENERATION_PROFILES: dict[Difficulty, GenerationProfile] = {
    Difficulty.easy: GenerationProfile(
        carve_givens=30,
        min_givens=30,
        digs_per_grid=1,
        probes_per_round=0,
        rounds=0,
        time_budget_seconds=60.0,
    ),
    # Medium carves denser than its givens floor, then deepens toward the corridor.
    Difficulty.medium: GenerationProfile(
        carve_givens=30,
        min_givens=24,
        digs_per_grid=24,
        probes_per_round=10,
        rounds=6,
        time_budget_seconds=180.0,
    ),
    Difficulty.hard: GenerationProfile(
        carve_givens=18,
        min_givens=18,
        digs_per_grid=24,
        probes_per_round=15,
        rounds=8,
        time_budget_seconds=300.0,
    ),
}


class ProbeKind(StrEnum):
    abort = "abort"
    hard_zone = "hard_zone"
    found = "found"
    keep_going = "keep_going"
    improve = "improve"


@dataclass
class GenerateSearchStats:
    digs: int = 0
    hard_zone_hits: int = 0
    grade_too_low: int = 0


@dataclass
class DeepenContext:
    difficulty: Difficulty
    rng: random.Random
    deadline: float
    stats: GenerateSearchStats
    profile: GenerationProfile


@dataclass(frozen=True)
class Candidate:
    puzzle: str
    grade: float
    has_medium: bool


@dataclass(frozen=True)
class GeneratedPuzzle:
    puzzle: str
    solution: str
    difficulty: Difficulty
    givens_count: int


def generate_puzzle(
    difficulty: Difficulty,
    rng: random.Random | None = None,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    max_generate_seconds: float | None = None,
) -> GeneratedPuzzle:
    if difficulty not in GENERATION_PROFILES:
        raise ValueError(f"invalid difficulty: {difficulty}")
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least 1")
    profile = GENERATION_PROFILES[difficulty]
    generate_seconds = (
        profile.time_budget_seconds if max_generate_seconds is None else max_generate_seconds
    )
    if generate_seconds <= 0:
        raise ValueError("max_generate_seconds must be positive")

    random_source = rng or random.Random()
    ctx = DeepenContext(
        difficulty=difficulty,
        rng=random_source,
        deadline=time.monotonic() + generate_seconds,
        stats=GenerateSearchStats(),
        profile=profile,
    )

    for _ in range(max_attempts):
        if time.monotonic() >= ctx.deadline:
            break
        solution = generate_complete_grid(random_source)
        for _ in range(ctx.profile.digs_per_grid):
            if time.monotonic() >= ctx.deadline:
                break
            ctx.stats.digs += 1
            # carve_puzzle already keeps uniqueness; solution is the unique completion.
            puzzle = carve_puzzle(solution, random_source, min_givens=ctx.profile.carve_givens)
            accepted = accept_or_deepen(puzzle, solution, ctx)
            if accepted is not None:
                return accepted

    message = (
        f"failed to generate {difficulty} puzzle within "
        f"{generate_seconds:g}s / {max_attempts} attempts"
    )
    if difficulty == Difficulty.medium:
        message += (
            f" (digs={ctx.stats.digs}, hard_zone_hits={ctx.stats.hard_zone_hits}, "
            f"grade_too_low={ctx.stats.grade_too_low})"
        )
    logger.warning(message)
    raise RuntimeError(message)


def accept_or_deepen(
    puzzle: str,
    solution: str,
    ctx: DeepenContext,
) -> GeneratedPuzzle | None:
    rating = _rate_for_target(puzzle, ctx.difficulty)
    if rating is None:
        ctx.stats.hard_zone_hits += 1
        return None
    if matches_target_difficulty(rating, ctx.difficulty):
        if ctx.difficulty == Difficulty.easy and easy_path_forces_hard_naked_single(puzzle):
            return None
        return _to_generated(puzzle, solution, ctx.difficulty)
    if ctx.difficulty == Difficulty.easy:
        return None
    has_medium = uses_medium_technique(rating)
    if ctx.difficulty == Difficulty.medium and has_medium:
        ctx.stats.grade_too_low += 1
    deepened = _deepen_toward_target(
        Candidate(puzzle, grade_from_result(rating), has_medium),
        ctx,
    )
    if deepened is None:
        return None
    return _to_generated(deepened, solution, ctx.difficulty)


def _rate_for_target(
    puzzle: str,
    difficulty: Difficulty,
) -> TechniqueSolveResult | None:
    if difficulty == Difficulty.hard:
        # Solvable with medium techniques alone cannot be hard – skip full rate/deepen.
        if solve_with_techniques(puzzle, MEDIUM_TECHNIQUES).solved:
            return None
        return _rate_supported_puzzle(puzzle)
    if difficulty == Difficulty.medium:
        # Must stay solvable without hard techniques (medium corridor).
        medium_result = solve_with_techniques(puzzle, MEDIUM_TECHNIQUES)
        if not medium_result.solved:
            return None
        return medium_result
    return _rate_supported_puzzle(puzzle)


def _rate_supported_puzzle(puzzle: str) -> TechniqueSolveResult | None:
    try:
        return rate_puzzle(puzzle)
    except ValueError:
        return None


@dataclass(frozen=True)
class _RoundOutcome:
    puzzle: str | None
    grade: float
    has_medium: bool
    done: bool


@dataclass(frozen=True)
class _ProbeOutcome:
    kind: ProbeKind
    puzzle: str
    grade: float
    has_medium: bool
    streak: int


@dataclass
class _EasyMemory:
    medium_low: tuple[str, float] | None = None
    easy_fallback: tuple[str, float] | None = None


def _without_given(puzzle: str, index: int) -> str:
    cells = list(puzzle)
    cells[index] = "0"
    return "".join(cells)


def _remember_easy_child(
    puzzle: str,
    grade: float,
    has_medium: bool,
    memory: _EasyMemory,
) -> None:
    if has_medium:
        if memory.medium_low is None or grade > memory.medium_low[1]:
            memory.medium_low = (puzzle, grade)
        return
    if memory.easy_fallback is None:
        memory.easy_fallback = (puzzle, grade)


def _assess_deepen_probe(
    probed: str,
    current: Candidate,
    ctx: DeepenContext,
    streak: int,
    memory: _EasyMemory,
) -> _ProbeOutcome:
    rating = _rate_for_target(probed, ctx.difficulty)
    if rating is None:
        ctx.stats.hard_zone_hits += 1
        streak += 1
        if ctx.difficulty == Difficulty.medium and streak >= _MEDIUM_HARD_ZONE_STREAK_ABORT:
            return _ProbeOutcome(ProbeKind.abort, probed, current.grade, current.has_medium, streak)
        return _ProbeOutcome(ProbeKind.hard_zone, probed, current.grade, current.has_medium, streak)
    if matches_target_difficulty(rating, ctx.difficulty):
        return _ProbeOutcome(ProbeKind.found, probed, current.grade, current.has_medium, 0)
    probed_grade = grade_from_result(rating)
    probed_has_medium = uses_medium_technique(rating)
    if ctx.difficulty == Difficulty.medium and probed_has_medium:
        ctx.stats.grade_too_low += 1
    if ctx.difficulty == Difficulty.medium and not current.has_medium:
        _remember_easy_child(probed, probed_grade, probed_has_medium, memory)
        return _ProbeOutcome(ProbeKind.keep_going, probed, current.grade, current.has_medium, 0)
    if probed_grade > current.grade:
        return _ProbeOutcome(ProbeKind.improve, probed, probed_grade, probed_has_medium, 0)
    return _ProbeOutcome(ProbeKind.keep_going, probed, current.grade, current.has_medium, 0)


def _adopt_remembered_child(memory: _EasyMemory) -> tuple[str, float, bool] | None:
    chosen = memory.medium_low or memory.easy_fallback
    if chosen is None:
        return None
    puzzle, grade = chosen
    has_medium = memory.medium_low is not None and chosen is memory.medium_low
    return puzzle, grade, has_medium


def _close_deepen_round(
    current: Candidate,
    ctx: DeepenContext,
    improved: bool,
    probes_used: int,
    hard_only_round: bool,
    memory: _EasyMemory,
) -> _RoundOutcome:
    puzzle = current.puzzle
    grade = current.grade
    has_medium = current.has_medium
    if ctx.difficulty == Difficulty.medium and not has_medium and not improved:
        adopted = _adopt_remembered_child(memory)
        if adopted is not None:
            puzzle, grade, has_medium = adopted
            improved = True
    if ctx.difficulty == Difficulty.medium and probes_used > 0 and hard_only_round:
        return _RoundOutcome(None, grade, has_medium, True)
    if not improved:
        return _RoundOutcome(None, grade, has_medium, True)
    return _RoundOutcome(puzzle, grade, has_medium, False)


def _deepen_one_round(current: Candidate, ctx: DeepenContext) -> _RoundOutcome:
    given_indices = [index for index, digit in enumerate(current.puzzle) if digit != "0"]
    ctx.rng.shuffle(given_indices)
    improved = False
    probes_used = 0
    hard_only_round = True
    streak = 0
    memory = _EasyMemory()

    for index in given_indices:
        if time.monotonic() >= ctx.deadline:
            return _RoundOutcome(None, current.grade, current.has_medium, True)
        if probes_used >= ctx.profile.probes_per_round:
            break
        probed = _without_given(current.puzzle, index)
        if count_solutions(probed, limit=2) != 1:
            continue
        probes_used += 1
        outcome = _assess_deepen_probe(probed, current, ctx, streak, memory)
        if outcome.kind == ProbeKind.hard_zone:
            streak = outcome.streak
            continue
        if outcome.kind == ProbeKind.abort:
            return _RoundOutcome(None, current.grade, current.has_medium, True)
        if outcome.kind == ProbeKind.found:
            return _RoundOutcome(outcome.puzzle, current.grade, current.has_medium, True)
        streak = 0
        hard_only_round = False
        if outcome.kind == ProbeKind.improve:
            current = Candidate(outcome.puzzle, outcome.grade, outcome.has_medium)
            improved = True
            break

    return _close_deepen_round(
        current,
        ctx,
        improved,
        probes_used,
        hard_only_round,
        memory,
    )


def _deepen_toward_target(current: Candidate, ctx: DeepenContext) -> str | None:
    for _ in range(ctx.profile.rounds):
        if time.monotonic() >= ctx.deadline:
            return None
        if givens_count(current.puzzle) <= ctx.profile.min_givens:
            return None
        outcome = _deepen_one_round(current, ctx)
        if outcome.done:
            return outcome.puzzle
        if outcome.puzzle is None:
            raise RuntimeError("deepen round continued without a puzzle")
        current = Candidate(outcome.puzzle, outcome.grade, outcome.has_medium)

    return None


def _to_generated(
    puzzle: str,
    solution: str,
    difficulty: Difficulty,
) -> GeneratedPuzzle:
    return GeneratedPuzzle(
        puzzle=puzzle,
        solution=solution,
        difficulty=difficulty,
        givens_count=givens_count(puzzle),
    )
