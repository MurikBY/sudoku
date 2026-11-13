import asyncio
import os
import statistics
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

import pytest

from app.models.enums import Difficulty
from app.services.puzzle_generator import PuzzleGenerationFailed, PuzzleGenerator
from app.services.sudoku.carver import givens_count
from app.services.sudoku.solver import count_solutions, solve
from tests.puzzle_generation_workers import (
    CRASH_MARKER_ENV,
    crash_on_first_call,
    raise_generation_failed,
    report_niceness,
)

# A busy CI runner, not the idle-machine measurement (0.7 ms median, under 60 ms max).
_MAX_MEDIAN_WAKEUP_DELAY_SECONDS = 0.005
_MAX_WAKEUP_DELAY_SECONDS = 0.250
_WAKEUP_INTERVAL_SECONDS = 0.005


@asynccontextmanager
async def _running(generator: PuzzleGenerator) -> AsyncIterator[PuzzleGenerator]:
    await generator.start()
    try:
        yield generator
    finally:
        await generator.stop()


async def _record_wakeup_delays(delays: list[float]) -> None:
    while True:
        started = time.perf_counter()
        await asyncio.sleep(_WAKEUP_INTERVAL_SECONDS)
        delays.append(time.perf_counter() - started - _WAKEUP_INTERVAL_SECONDS)


def _assert_wakeup_delays(delays: list[float]) -> None:
    assert delays, "no wakeups recorded during generation"
    median_delay = statistics.median(delays)
    maximum_delay = max(delays)
    assert median_delay < _MAX_MEDIAN_WAKEUP_DELAY_SECONDS, median_delay
    assert maximum_delay < _MAX_WAKEUP_DELAY_SECONDS, maximum_delay


@pytest.mark.asyncio
async def test_generate_before_start_raises() -> None:
    generator = PuzzleGenerator()
    with pytest.raises(RuntimeError, match="puzzle generator is not started"):
        await generator.generate(Difficulty.easy)


@pytest.mark.asyncio
async def test_generation_failed_surfaces_as_puzzle_generation_failed() -> None:
    generator = PuzzleGenerator(worker=raise_generation_failed)
    async with _running(generator):
        with pytest.raises(PuzzleGenerationFailed, match=r"^x$"):
            await generator.generate(Difficulty.easy)


@pytest.mark.asyncio
async def test_worker_runs_at_a_higher_nice_value() -> None:
    parent_nice = os.nice(0)
    generator = PuzzleGenerator(worker=report_niceness)
    async with _running(generator):
        generated = await generator.generate(Difficulty.easy)
    assert generated.givens_count > parent_nice, (generated.givens_count, parent_nice)


@pytest.mark.asyncio
async def test_worker_crash_fails_once_then_the_next_generate_succeeds(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    marker_path = tmp_path / "crash-marker"
    monkeypatch.setenv(CRASH_MARKER_ENV, str(marker_path))
    generator = PuzzleGenerator(worker=crash_on_first_call)
    async with _running(generator):
        with pytest.raises(PuzzleGenerationFailed):
            await generator.generate(Difficulty.easy)
        await generator.generate(Difficulty.easy)


@pytest.mark.asyncio
async def test_worker_returns_valid_easy_puzzle() -> None:
    async with _running(PuzzleGenerator()) as generator:
        generated = await generator.generate(Difficulty.easy)
    assert generated.difficulty == Difficulty.easy
    assert count_solutions(generated.puzzle) == 1
    assert solve(generated.puzzle) == generated.solution
    assert generated.givens_count == givens_count(generated.puzzle)


@pytest.mark.asyncio
async def test_hard_generate_does_not_stall_the_event_loop() -> None:
    delays: list[float] = []
    async with _running(PuzzleGenerator()) as generator:
        watcher = asyncio.create_task(_record_wakeup_delays(delays))
        try:
            await generator.generate(Difficulty.hard)
        finally:
            watcher.cancel()
            with suppress(asyncio.CancelledError):
                await watcher
    _assert_wakeup_delays(delays)
