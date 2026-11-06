import asyncio
import logging
import multiprocessing
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool

from app.models.enums import Difficulty
from app.services.sudoku.generation_worker import (
    GenerationFailed,
    generate_in_worker,
    initialize_worker,
    warm_up,
)
from app.services.sudoku.puzzle import GeneratedPuzzle

logger = logging.getLogger(__name__)

type PuzzleWorker = Callable[[Difficulty], GeneratedPuzzle]


class PuzzleGenerationFailed(Exception):
    pass


class PuzzleGenerator:
    def __init__(self, worker: PuzzleWorker = generate_in_worker) -> None:
        self._worker = worker
        self._executor: ProcessPoolExecutor | None = None

    async def start(self) -> None:
        executor = _new_executor()
        self._executor = executor
        try:
            await asyncio.wrap_future(executor.submit(warm_up))
        except BaseException:
            self._executor = None
            executor.shutdown(wait=False, cancel_futures=True)
            raise

    async def stop(self) -> None:
        executor = self._executor
        if executor is None:
            return
        self._executor = None
        executor.shutdown(wait=False, cancel_futures=True)

    async def generate(self, difficulty: Difficulty) -> GeneratedPuzzle:
        executor = self._executor
        if executor is None:
            raise RuntimeError("puzzle generator is not started")
        try:
            future = executor.submit(self._worker, difficulty)
            return await asyncio.wrap_future(future)
        except GenerationFailed as error:
            raise PuzzleGenerationFailed(str(error)) from error
        except BrokenProcessPool as error:
            logger.error("puzzle generation worker died: %s", error)
            self._replace_executor(executor)
            raise PuzzleGenerationFailed(str(error)) from error

    def _replace_executor(self, failed: ProcessPoolExecutor) -> None:
        if self._executor is not failed:
            return
        self._executor = _new_executor()
        failed.shutdown(wait=False, cancel_futures=True)


def _new_executor() -> ProcessPoolExecutor:
    # Fork would copy the event loop and live database connections.
    return ProcessPoolExecutor(
        max_workers=1,
        mp_context=multiprocessing.get_context("spawn"),
        initializer=initialize_worker,
    )


puzzle_generator = PuzzleGenerator()
