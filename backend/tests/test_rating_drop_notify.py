import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.enums import Difficulty, GameStatus
from app.models.game import Game
from app.services.preferences_service import DEFAULT_ASSISTS
from app.services.rating_notify import build_top10_drop_message
from app.services.stats.clean_best import ejected_top10_user_id
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
        assert await ejected_top10_user_id(session, entering) == EASY_TENTH_USER_ID


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
        assert await ejected_top10_user_id(session, tenth) is None


@pytest.mark.asyncio
async def test_ejected_top10_none_when_existing_top10_improves(
    isolated_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with isolated_session_factory() as session:
        await _seed_easy_top10(session)
        improved = await _add_completed_game(session, 1001, elapsed_seconds=40)
        assert await ejected_top10_user_id(session, improved) is None


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
        assert await ejected_top10_user_id(session, entering) == EASY_TENTH_USER_ID


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
        assert await ejected_top10_user_id(session, dirty) is None
        assert await ejected_top10_user_id(session, analysis) is None
        assert await ejected_top10_user_id(session, lesson) is None


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
        assert await ejected_top10_user_id(session, medium) is None
