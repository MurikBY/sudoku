import time
from collections.abc import Callable

from app.models.enums import Difficulty

# A reset followed by a clean win re-enters the Top 10 at will, so one player
# gets at most one "pushed out" message per difficulty in this window.
TOP10_DROP_COOLDOWN_SECONDS = 24 * 60 * 60


class Top10DropCooldown:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._sent_at: dict[tuple[int, Difficulty], float] = {}

    def claim(self, user_id: int, difficulty: Difficulty) -> bool:
        now = self._clock()
        key = (user_id, difficulty)
        sent_at = self._sent_at.get(key)
        if sent_at is not None and now - sent_at < TOP10_DROP_COOLDOWN_SECONDS:
            return False
        self._sent_at[key] = now
        return True


top10_drop_cooldown = Top10DropCooldown()
