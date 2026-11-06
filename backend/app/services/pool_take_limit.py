import time
from collections.abc import Callable

from app.services.errors import TooManyRequestsError

POOL_TAKES_PER_WINDOW = 6
POOL_TAKE_WINDOW_SECONDS = 60


class PoolTakeRateLimited(TooManyRequestsError):
    def __init__(self) -> None:
        super().__init__("Too many new games in a minute. Try again shortly.")


class PoolTakeLimit:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._taken_at: dict[int, list[float]] = {}

    def acquire(self, user_id: int) -> None:
        now = self._clock()
        recent = [
            taken_at
            for taken_at in self._taken_at.get(user_id, [])
            if now - taken_at < POOL_TAKE_WINDOW_SECONDS
        ]
        if len(recent) >= POOL_TAKES_PER_WINDOW:
            self._taken_at[user_id] = recent
            raise PoolTakeRateLimited()
        recent.append(now)
        self._taken_at[user_id] = recent


pool_take_limit = PoolTakeLimit()
