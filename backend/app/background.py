import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

logger = logging.getLogger(__name__)

_tasks: set[asyncio.Task[Any]] = set()


def spawn(coroutine: Coroutine[Any, Any, Any], *, name: str) -> asyncio.Task[Any]:
    task = asyncio.create_task(coroutine, name=name)
    _tasks.add(task)
    task.add_done_callback(_finish_task)
    return task


def _finish_task(task: asyncio.Task[Any]) -> None:
    _tasks.discard(task)
    try:
        task.result()
    except asyncio.CancelledError:
        return
    except Exception:
        logger.exception("background task %s failed", task.get_name())


async def cancel_all() -> None:
    tasks = tuple(_tasks)
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def drain() -> None:
    while _tasks:
        await asyncio.gather(*tuple(_tasks))
