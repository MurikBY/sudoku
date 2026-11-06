import asyncio
import logging
import time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.background import spawn
from app.config import settings
from app.db import open_session
from app.models.enums import Difficulty
from app.models.puzzle_pool import PuzzlePoolEntry
from app.services import pool_take_limit as pool_take_limits
from app.services.errors import UnavailableError
from app.services.puzzle_generator import PuzzleGenerationFailed, puzzle_generator
from app.services.sudoku.puzzle import GeneratedPuzzle

logger = logging.getLogger(__name__)


class PuzzlePoolEmpty(UnavailableError):
    pass


_refill_lock = asyncio.Lock()
_REFILL_GENERATE_ATTEMPTS = 3


async def count_pooled(session: AsyncSession, difficulty: Difficulty) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(PuzzlePoolEntry)
        .where(PuzzlePoolEntry.difficulty == difficulty),
    )
    return int(result.scalar_one())


async def take_puzzle(
    session: AsyncSession,
    difficulty: Difficulty,
) -> GeneratedPuzzle | None:
    result = await session.execute(
        select(PuzzlePoolEntry)
        .where(PuzzlePoolEntry.difficulty == difficulty)
        .order_by(PuzzlePoolEntry.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True),
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None

    generated = GeneratedPuzzle(
        puzzle=entry.puzzle,
        solution=entry.solution,
        difficulty=entry.difficulty,
        givens_count=entry.givens_count,
    )
    await session.delete(entry)
    await session.flush()
    return generated


async def take_puzzle_for_play(
    session: AsyncSession,
    difficulty: Difficulty,
    *,
    taker_id: int,
) -> GeneratedPuzzle:
    pool_take_limits.pool_take_limit.acquire(taker_id)
    generated = await take_puzzle(session, difficulty)
    schedule_refill(difficulty)
    if generated is None:
        raise PuzzlePoolEmpty(
            "No puzzles ready for this difficulty. Try again in a couple of minutes.",
        )
    return generated


async def add_generated_to_pool(
    session: AsyncSession,
    generated: GeneratedPuzzle,
) -> PuzzlePoolEntry:
    entry = PuzzlePoolEntry(
        difficulty=generated.difficulty,
        puzzle=generated.puzzle,
        solution=generated.solution,
        givens_count=generated.givens_count,
    )
    session.add(entry)
    await session.flush()
    return entry


async def refill_one(difficulty: Difficulty) -> None:
    last_error: Exception | None = None
    for attempt in range(1, _REFILL_GENERATE_ATTEMPTS + 1):
        try:
            generated = await puzzle_generator.generate(difficulty)
            async with open_session() as session:
                await add_generated_to_pool(session, generated)
                await session.commit()
            return
        except PuzzleGenerationFailed as error:
            last_error = error
            logger.warning(
                "puzzle generate failed for %s (attempt %s/%s): %s",
                difficulty.value,
                attempt,
                _REFILL_GENERATE_ATTEMPTS,
                error,
            )
    raise RuntimeError(
        f"puzzle generation failed after {_REFILL_GENERATE_ATTEMPTS} attempts",
    ) from last_error


async def ensure_stock(difficulty: Difficulty) -> None:
    stock_target = settings.PUZZLE_POOL_TARGET_SIZE
    if stock_target < 1:
        return

    async with open_session() as session:
        available = await count_pooled(session, difficulty)

    if available >= stock_target:
        return

    generate_seconds: list[float] = []
    logger.info(
        "puzzle pool %s refill %s -> %s",
        difficulty.value,
        available,
        stock_target,
    )

    while available < stock_target:
        generate_started = time.monotonic()
        try:
            await refill_one(difficulty)
        except RuntimeError:
            logger.exception(
                "puzzle pool refill stopping early for %s at %s/%s",
                difficulty.value,
                available,
                stock_target,
            )
            _log_refill_report(difficulty, generate_seconds)
            return
        elapsed = time.monotonic() - generate_started
        generate_seconds.append(elapsed)
        available += 1
        logger.info(
            "puzzle pool %s %s/%s in %.1fs",
            difficulty.value,
            available,
            stock_target,
            elapsed,
        )

    _log_refill_report(difficulty, generate_seconds)


def _log_refill_report(difficulty: Difficulty, generate_seconds: list[float]) -> None:
    added = len(generate_seconds)
    if added == 0:
        return
    fastest = min(generate_seconds)
    slowest = max(generate_seconds)
    average = sum(generate_seconds) / added
    logger.info(
        "puzzle pool %s finished: added %s, generate %.1f–%.1fs avg %.1fs",
        difficulty.value,
        added,
        fastest,
        slowest,
        average,
    )


async def ensure_all_stock() -> None:
    async with _refill_lock:
        for difficulty in Difficulty:
            try:
                await ensure_stock(difficulty)
            except Exception:
                logger.exception("puzzle pool refill failed for %s", difficulty.value)


def schedule_refill(difficulty: Difficulty) -> None:
    if not settings.PUZZLE_POOL_REFILL_ENABLED:
        return
    spawn(_refill_after_take(difficulty), name=f"pool-refill-{difficulty.value}")


async def _refill_after_take(difficulty: Difficulty) -> None:
    async with _refill_lock:
        try:
            await ensure_stock(difficulty)
        except Exception:
            logger.exception("puzzle pool top-up failed for %s", difficulty.value)


async def run_pool_refill_loop(
    interval_seconds: float | None = None,
) -> None:
    sleep_seconds = (
        settings.PUZZLE_POOL_REFILL_INTERVAL_SECONDS
        if interval_seconds is None
        else interval_seconds
    )
    await ensure_all_stock()
    while True:
        await asyncio.sleep(sleep_seconds)
        await ensure_all_stock()
