import asyncio

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.enums import Difficulty, GameStatus
from app.models.game import Game
from app.services.games.lifecycle import abandon_all_in_progress_games, complete_game
from app.services.games.moves import CellMove, apply_move
from app.services.lesson_progress_service import record_if_objective_met
from app.services.preferences_service import DEFAULT_ASSISTS
from app.services.user_upsert import upsert_telegram_user
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION

_LOCK_WAIT_COUNT = text(
    "SELECT count(*) FROM pg_stat_activity "
    "WHERE wait_event_type = 'Lock' "
    "AND datname = current_database() "
    "AND pid <> pg_backend_pid()",
)


@pytest.mark.asyncio
async def test_concurrent_moves_keep_both_cells_and_events(
    isolated_session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first_index = 0
    second_index = 1
    first_value = int(KNOWN_SOLUTION[first_index])
    second_value = int(KNOWN_SOLUTION[second_index])
    assert KNOWN_PUZZLE[first_index] == "0"
    assert KNOWN_PUZZLE[second_index] == "0"

    async with isolated_session_factory() as session:
        user = await upsert_telegram_user(session, 42, "tester")
        game = Game(
            user_id=user.id,
            difficulty=Difficulty.easy,
            status=GameStatus.in_progress,
            puzzle=KNOWN_PUZZLE,
            solution=KNOWN_SOLUTION,
            current_grid=KNOWN_PUZZLE,
            notes={},
            undo_stack=[],
            events=[],
            assists=DEFAULT_ASSISTS.model_dump(mode="json"),
            share_code="LOCKGAME",
        )
        session.add(game)
        await session.commit()
        game_id = game.id
        user_id = user.id

    readers = 0
    first_move_holds_row = asyncio.Event()
    release_first_move = asyncio.Event()

    async def pause_first_move(session: AsyncSession, game: Game) -> None:
        # Row lock stays held until the test sees the other move waiting on it.
        nonlocal readers
        readers += 1
        if readers == 1:
            first_move_holds_row.set()
            await release_first_move.wait()
        await record_if_objective_met(session, game)

    monkeypatch.setattr("app.services.games.moves.record_if_objective_met", pause_first_move)

    async def place(cell_index: int, value: int) -> None:
        async with isolated_session_factory() as session:
            await apply_move(
                session,
                user_id,
                game_id,
                CellMove(
                    index=cell_index,
                    value=value,
                ),
                None,
            )

    first_move = asyncio.create_task(place(first_index, first_value))
    second_move: asyncio.Task[None] | None = None
    try:
        await asyncio.wait_for(first_move_holds_row.wait(), timeout=5)
        second_move = asyncio.create_task(place(second_index, second_value))
        saw_lock_wait = False
        async with isolated_session_factory() as watch:
            for _ in range(200):
                if readers == 2:
                    break
                waiting = await watch.scalar(_LOCK_WAIT_COUNT)
                if waiting:
                    saw_lock_wait = True
                    break
                await asyncio.sleep(0.01)
            else:
                raise AssertionError("second move did not overlap the first")
        release_first_move.set()
        await asyncio.wait_for(asyncio.gather(first_move, second_move), timeout=5)
    finally:
        release_first_move.set()
        for task in (first_move, second_move):
            if task is not None and not task.done():
                task.cancel()
        pending = [task for task in (first_move, second_move) if task is not None]
        await asyncio.gather(*pending, return_exceptions=True)

    assert saw_lock_wait, "second move did not wait for the game row lock"

    async with isolated_session_factory() as session:
        stored = await session.get(Game, game_id)

    assert stored is not None
    assert stored.current_grid[first_index] == str(first_value)
    assert stored.current_grid[second_index] == str(second_value)
    assert len(stored.events) == 2
    assert {(event["cell"], event["value"]) for event in stored.events} == {
        (first_index, first_value),
        (second_index, second_value),
    }


@pytest.mark.asyncio
async def test_abandon_keeps_a_game_that_completed_while_it_waited(
    isolated_session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with isolated_session_factory() as session:
        user = await upsert_telegram_user(session, 42, "tester")
        game = Game(
            user_id=user.id,
            difficulty=Difficulty.easy,
            status=GameStatus.in_progress,
            puzzle=KNOWN_PUZZLE,
            solution=KNOWN_SOLUTION,
            current_grid=KNOWN_SOLUTION,
            notes={},
            undo_stack=[],
            events=[],
            assists=DEFAULT_ASSISTS.model_dump(mode="json"),
            share_code="DONEGAME",
        )
        session.add(game)
        await session.commit()
        game_id = game.id
        user_id = user.id

    complete_holds_row = asyncio.Event()
    release_complete = asyncio.Event()

    async def pause_before_commit(session: AsyncSession, held_game: Game) -> None:
        complete_holds_row.set()
        await release_complete.wait()
        await record_if_objective_met(session, held_game)

    monkeypatch.setattr(
        "app.services.games.lifecycle.record_if_objective_met",
        pause_before_commit,
    )

    async def finish() -> None:
        async with isolated_session_factory() as session:
            await complete_game(session, user_id, game_id, 10)

    async def abandon() -> None:
        async with isolated_session_factory() as session:
            await abandon_all_in_progress_games(session, user_id)
            await session.commit()

    finishing = asyncio.create_task(finish())
    abandoning: asyncio.Task[None] | None = None
    try:
        await asyncio.wait_for(complete_holds_row.wait(), timeout=5)
        abandoning = asyncio.create_task(abandon())
        saw_lock_wait = False
        async with isolated_session_factory() as watch:
            for _ in range(200):
                waiting = await watch.scalar(_LOCK_WAIT_COUNT)
                if waiting:
                    saw_lock_wait = True
                    break
                await asyncio.sleep(0.01)
            else:
                raise AssertionError("abandon did not wait for the game row lock")
        release_complete.set()
        await asyncio.wait_for(asyncio.gather(finishing, abandoning), timeout=5)
    finally:
        release_complete.set()
        for task in (finishing, abandoning):
            if task is not None and not task.done():
                task.cancel()
        pending = [task for task in (finishing, abandoning) if task is not None]
        await asyncio.gather(*pending, return_exceptions=True)

    assert saw_lock_wait, "abandon did not wait for the game row lock"

    async with isolated_session_factory() as session:
        stored = await session.get(Game, game_id)

    assert stored is not None
    assert stored.status == GameStatus.completed
