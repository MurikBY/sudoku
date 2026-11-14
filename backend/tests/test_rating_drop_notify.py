import logging
import uuid
from datetime import UTC, datetime
from typing import cast

import pytest
from aiogram import Bot
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.background import drain
from app.models.enums import Difficulty, GameStatus
from app.models.game import Game
from app.models.user import User
from app.services.game_completion_notify import announce_completion
from app.services.preferences_service import DEFAULT_ASSISTS
from app.services.rating_notify import build_top10_drop_message, send_top10_drop_message
from app.services.stats.clean_best import completion_ranks, ejected_top10_user_id
from app.services.top10_drop_cooldown import TOP10_DROP_COOLDOWN_SECONDS, Top10DropCooldown
from app.services.user_reset_service import reset_user_play_data
from app.services.user_upsert import upsert_telegram_user
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION

EASY_TENTH_USER_ID = 1010
EASY_ELEVENTH_USER_ID = 1011


def test_build_top10_drop_message_uses_difficulty_name() -> None:
    assert (
        build_top10_drop_message(Difficulty.easy)
        == "You were pushed out of the Easy Top 10. Play a clean game to climb back."
    )
    assert "Medium Top 10" in build_top10_drop_message(Difficulty.medium)
    assert "Hard Top 10" in build_top10_drop_message(Difficulty.hard)


async def _add_completed_game(
    session: AsyncSession,
    user_id: int,
    *,
    difficulty: Difficulty = Difficulty.easy,
    elapsed_seconds: int,
    mistakes_count: int = 0,
    hints_count: int = 0,
    is_analysis: bool = False,
    is_lesson: bool = False,
) -> Game:
    await upsert_telegram_user(session, user_id, f"u{user_id}")
    game = Game(
        user_id=user_id,
        difficulty=difficulty,
        status=GameStatus.completed,
        puzzle=KNOWN_PUZZLE,
        solution=KNOWN_SOLUTION,
        current_grid=KNOWN_SOLUTION,
        elapsed_seconds=elapsed_seconds,
        mistakes_count=mistakes_count,
        hints_count=hints_count,
        is_analysis=is_analysis,
        is_lesson=is_lesson,
        assists=DEFAULT_ASSISTS.model_dump(mode="json"),
        share_code=uuid.uuid4().hex[:8].upper(),
        completed_at=datetime.now(UTC),
    )
    session.add(game)
    await session.commit()
    await session.refresh(game)
    return game


async def _ejected(session: AsyncSession, game: Game) -> int | None:
    return await ejected_top10_user_id(session, game, await completion_ranks(session, game))


async def _seed_easy_top10(session: AsyncSession) -> None:
    for index in range(10):
        await _add_completed_game(
            session,
            1001 + index,
            elapsed_seconds=100 + index * 10,
        )


@pytest.mark.asyncio
async def test_ejected_top10_when_new_player_enters(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with isolated_session_factory() as session:
        await _seed_easy_top10(session)
        entering = await _add_completed_game(
            session,
            EASY_ELEVENTH_USER_ID,
            elapsed_seconds=50,
        )
        assert await _ejected(session, entering) == EASY_TENTH_USER_ID


@pytest.mark.asyncio
async def test_ejected_top10_none_when_board_had_fewer_than_ten(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with isolated_session_factory() as session:
        for index in range(9):
            await _add_completed_game(
                session,
                1001 + index,
                elapsed_seconds=100 + index * 10,
            )
        tenth = await _add_completed_game(session, EASY_TENTH_USER_ID, elapsed_seconds=50)
        assert await _ejected(session, tenth) is None


@pytest.mark.asyncio
async def test_ejected_top10_none_when_existing_top10_improves(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with isolated_session_factory() as session:
        await _seed_easy_top10(session)
        improved = await _add_completed_game(session, 1001, elapsed_seconds=40)
        assert await _ejected(session, improved) is None


@pytest.mark.asyncio
async def test_ejected_top10_when_eleventh_moves_into_tenth(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with isolated_session_factory() as session:
        await _seed_easy_top10(session)
        await _add_completed_game(
            session,
            EASY_ELEVENTH_USER_ID,
            elapsed_seconds=250,
        )
        entering = await _add_completed_game(
            session,
            EASY_ELEVENTH_USER_ID,
            elapsed_seconds=105,
        )
        assert await _ejected(session, entering) == EASY_TENTH_USER_ID


@pytest.mark.asyncio
async def test_ejected_top10_none_for_dirty_or_analysis(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with isolated_session_factory() as session:
        await _seed_easy_top10(session)
        dirty = await _add_completed_game(
            session,
            EASY_ELEVENTH_USER_ID,
            elapsed_seconds=50,
            mistakes_count=1,
        )
        analysis = await _add_completed_game(
            session,
            EASY_ELEVENTH_USER_ID + 1,
            elapsed_seconds=40,
            is_analysis=True,
        )
        lesson = await _add_completed_game(
            session,
            EASY_ELEVENTH_USER_ID + 2,
            elapsed_seconds=30,
            is_lesson=True,
        )
        assert await _ejected(session, dirty) is None
        assert await _ejected(session, analysis) is None
        assert await _ejected(session, lesson) is None


@pytest.mark.asyncio
async def test_ejected_top10_ignores_other_difficulty(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with isolated_session_factory() as session:
        await _seed_easy_top10(session)
        medium = await _add_completed_game(
            session,
            EASY_ELEVENTH_USER_ID,
            difficulty=Difficulty.medium,
            elapsed_seconds=50,
        )
        assert await _ejected(session, medium) is None


class _RecordingBot:
    def __init__(self) -> None:
        self.messages: list[tuple[int, str]] = []

    async def send_message(self, chat_id: int, text: str, **_kwargs: object) -> None:
        self.messages.append((chat_id, text))


@pytest.mark.asyncio
async def test_reset_and_rewin_does_not_message_the_same_player_again(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    bot = _RecordingBot()
    async with isolated_session_factory() as session:
        await _seed_easy_top10(session)
        for _attempt in range(3):
            win = await _add_completed_game(session, EASY_ELEVENTH_USER_ID, elapsed_seconds=50)
            await announce_completion(cast(Bot, bot), session, win)
            await drain()
            attacker = await session.get(User, EASY_ELEVENTH_USER_ID)
            assert attacker is not None
            await reset_user_play_data(session, attacker)

    assert bot.messages == [(EASY_TENTH_USER_ID, build_top10_drop_message(Difficulty.easy))]


@pytest.mark.asyncio
async def test_top10_drop_message_logs_the_delivery(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bot = _RecordingBot()
    # Alembic's fileConfig disables loggers created before the migration runs.
    monkeypatch.setattr(logging.getLogger("app.services.rating_notify"), "disabled", False)
    caplog.set_level(logging.INFO, logger="app.services.rating_notify")

    await send_top10_drop_message(cast(Bot, bot), EASY_TENTH_USER_ID, Difficulty.easy)

    assert bot.messages == [(EASY_TENTH_USER_ID, build_top10_drop_message(Difficulty.easy))]
    assert [r.message for r in caplog.records if r.name == "app.services.rating_notify"] == [
        f"top10 drop notify: sent user_id={EASY_TENTH_USER_ID} difficulty=easy",
    ]


def test_cooldown_allows_one_message_per_player_and_difficulty_per_window() -> None:
    now = {"seconds": 1_000.0}
    cooldown = Top10DropCooldown(clock=lambda: now["seconds"])

    assert cooldown.claim(EASY_TENTH_USER_ID, Difficulty.easy)
    assert not cooldown.claim(EASY_TENTH_USER_ID, Difficulty.easy)
    assert cooldown.claim(EASY_TENTH_USER_ID, Difficulty.hard)
    assert cooldown.claim(EASY_ELEVENTH_USER_ID, Difficulty.easy)

    now["seconds"] += TOP10_DROP_COOLDOWN_SECONDS
    assert cooldown.claim(EASY_TENTH_USER_ID, Difficulty.easy)
