import asyncio
import os

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.enums import Difficulty
from app.models.puzzle_pool import PuzzlePoolEntry
from app.services import puzzle_pool_service
from app.services.puzzle_generator import PuzzleGenerationFailed
from app.services.sudoku.carver import givens_count
from app.services.sudoku.puzzle import GeneratedPuzzle
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION


@pytest.mark.asyncio
async def test_create_game_takes_puzzle_from_pool(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
):
    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            session.add(
                PuzzlePoolEntry(
                    difficulty=Difficulty.easy,
                    puzzle=KNOWN_PUZZLE,
                    solution=KNOWN_SOLUTION,
                    givens_count=givens_count(KNOWN_PUZZLE),
                ),
            )
            await session.commit()
    finally:
        await engine.dispose()

    async def boom(_difficulty: Difficulty) -> GeneratedPuzzle:
        raise AssertionError("puzzle generation must not run when the pool has stock")

    monkeypatch.setattr(puzzle_pool_service.puzzle_generator, "generate", boom)

    response = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["puzzle"] == KNOWN_PUZZLE

    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            remaining = await session.execute(
                select(func.count())
                .select_from(PuzzlePoolEntry)
                .where(PuzzlePoolEntry.difficulty == Difficulty.easy),
            )
            assert remaining.scalar_one() == 0
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_create_game_returns_503_when_pool_empty(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
):
    refill_calls: list[str] = []

    async def empty_take(_session, difficulty):
        return None

    monkeypatch.setattr("app.services.puzzle_pool_service.take_puzzle", empty_take)
    monkeypatch.setattr(
        "app.services.puzzle_pool_service.schedule_refill",
        lambda difficulty: refill_calls.append(difficulty.value),
    )

    response = await async_client.post(
        "/api/games",
        json={"difficulty": "medium"},
        headers=auth_headers,
    )
    assert response.status_code == 503
    assert response.json()["message"] == (
        "No puzzles ready for this difficulty. Try again in a couple of minutes."
    )
    assert refill_calls == ["medium"]


@pytest.mark.asyncio
async def test_take_puzzle_returns_none_when_empty(prepare_test_database: None):
    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            await session.execute(
                delete(PuzzlePoolEntry).where(PuzzlePoolEntry.difficulty == Difficulty.hard),
            )
            await session.commit()
            taken = await puzzle_pool_service.take_puzzle(session, Difficulty.hard)
            assert taken is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_add_and_take_roundtrip(prepare_test_database: None):
    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    generated = GeneratedPuzzle(
        puzzle=KNOWN_PUZZLE,
        solution=KNOWN_SOLUTION,
        difficulty=Difficulty.hard,
        givens_count=givens_count(KNOWN_PUZZLE),
    )
    try:
        async with session_factory() as session:
            await session.execute(
                delete(PuzzlePoolEntry).where(PuzzlePoolEntry.difficulty == Difficulty.hard),
            )
            await puzzle_pool_service.add_generated_to_pool(session, generated)
            await session.commit()

        async with session_factory() as session:
            taken = await puzzle_pool_service.take_puzzle(session, Difficulty.hard)
            await session.commit()
            assert taken is not None
            assert taken.puzzle == KNOWN_PUZZLE
            assert taken.difficulty == "hard"
            assert await puzzle_pool_service.take_puzzle(session, Difficulty.hard) is None
    finally:
        await engine.dispose()


class _IdleSession:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, *_args):
        return False


@pytest.mark.asyncio
async def test_concurrent_refill_after_take_stays_within_target(
    monkeypatch: pytest.MonkeyPatch,
):
    target = 4
    monkeypatch.setattr(puzzle_pool_service.settings, "PUZZLE_POOL_TARGET_SIZE", target)
    monkeypatch.setattr(puzzle_pool_service, "open_session", _IdleSession)

    available = target - 1

    async def fake_count(_session, _difficulty):
        return available

    async def fake_refill(_difficulty):
        nonlocal available
        # Yield so a missing lock lets the other refill read the same count.
        await asyncio.sleep(0)
        available += 1

    monkeypatch.setattr(puzzle_pool_service, "count_pooled", fake_count)
    monkeypatch.setattr(puzzle_pool_service, "refill_one", fake_refill)

    await asyncio.gather(
        puzzle_pool_service._refill_after_take(Difficulty.easy),
        puzzle_pool_service._refill_after_take(Difficulty.easy),
    )
    assert available == target


def _known_generated(difficulty: Difficulty) -> GeneratedPuzzle:
    return GeneratedPuzzle(
        puzzle=KNOWN_PUZZLE,
        solution=KNOWN_SOLUTION,
        difficulty=difficulty,
        givens_count=givens_count(KNOWN_PUZZLE),
    )


async def _pooled_count(session_factory, difficulty: Difficulty) -> int:
    async with session_factory() as session:
        result = await session.execute(
            select(func.count())
            .select_from(PuzzlePoolEntry)
            .where(PuzzlePoolEntry.difficulty == difficulty),
        )
        return int(result.scalar_one())


@pytest.mark.asyncio
async def test_refill_one_stores_one_pool_entry(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generated = _known_generated(Difficulty.easy)

    async def fake_generate(difficulty: Difficulty) -> GeneratedPuzzle:
        assert difficulty is Difficulty.easy
        return generated

    monkeypatch.setattr(puzzle_pool_service.puzzle_generator, "generate", fake_generate)

    await puzzle_pool_service.refill_one(Difficulty.easy)

    assert await _pooled_count(isolated_session_factory, Difficulty.easy) == 1
    async with isolated_session_factory() as session:
        stored = await session.scalar(
            select(PuzzlePoolEntry).where(PuzzlePoolEntry.difficulty == Difficulty.easy),
        )
    assert stored is not None
    assert stored.puzzle == KNOWN_PUZZLE
    assert stored.solution == KNOWN_SOLUTION
    assert stored.givens_count == generated.givens_count


@pytest.mark.asyncio
async def test_refill_one_stores_after_two_generation_failures(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generated = _known_generated(Difficulty.medium)
    attempts = 0

    async def fake_generate(difficulty: Difficulty) -> GeneratedPuzzle:
        nonlocal attempts
        assert difficulty is Difficulty.medium
        attempts += 1
        if attempts < 3:
            raise PuzzleGenerationFailed("bad puzzle")
        return generated

    monkeypatch.setattr(puzzle_pool_service.puzzle_generator, "generate", fake_generate)

    await puzzle_pool_service.refill_one(Difficulty.medium)

    assert attempts == 3
    assert await _pooled_count(isolated_session_factory, Difficulty.medium) == 1


@pytest.mark.asyncio
async def test_refill_one_raises_after_three_generation_failures(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_generate(_difficulty: Difficulty) -> GeneratedPuzzle:
        raise PuzzleGenerationFailed("bad puzzle")

    monkeypatch.setattr(puzzle_pool_service.puzzle_generator, "generate", fake_generate)

    with pytest.raises(RuntimeError, match="puzzle generation failed after 3 attempts") as raised:
        await puzzle_pool_service.refill_one(Difficulty.hard)

    assert isinstance(raised.value.__cause__, PuzzleGenerationFailed)
    assert await _pooled_count(isolated_session_factory, Difficulty.hard) == 0
