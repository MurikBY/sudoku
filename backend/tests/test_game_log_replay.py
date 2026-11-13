import os
import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.game import Game
from app.services.game_events import replay_events_to_state
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION

# Cells 0, 1, and 2 are empty in KNOWN_PUZZLE and share a row, so a digit in one
# clears the same pencil mark from the others.
FIRST = 0
SECOND = 1
THIRD = 2
RIGHT = int(KNOWN_SOLUTION[FIRST])
WRONG = 2 if RIGHT != 2 else 3

SCENARIOS: dict[str, list[tuple[Any, ...]]] = {
    "pencil marks": [
        ("notes", SECOND, [RIGHT, 5]),
        ("notes", SECOND, [5]),
        ("undo",),
        ("undo",),
    ],
    "digit that clears peer marks": [
        ("notes", SECOND, [RIGHT, 5]),
        ("notes", THIRD, [RIGHT]),
        ("set", FIRST, RIGHT),
        ("undo",),
    ],
    "replaced digit": [
        ("set", FIRST, WRONG),
        ("set", FIRST, RIGHT),
        ("undo",),
        ("undo",),
    ],
    # A correct digit cannot be cleared, so this clears a wrong one.
    "cleared cell": [
        ("notes", SECOND, [WRONG]),
        ("set", FIRST, WRONG),
        ("set", FIRST, 0),
        ("undo",),
        ("undo",),
    ],
}


async def _apply(
    async_client: AsyncClient,
    headers: dict[str, str],
    game_id: str,
    step: tuple[Any, ...],
) -> None:
    kind = step[0]
    if kind == "notes":
        url, body = f"/api/games/{game_id}/cells/{step[1]}/notes", {"digits": step[2]}
        response = await async_client.put(url, json=body, headers=headers)
    elif kind == "set":
        url, body = f"/api/games/{game_id}/cells/{step[1]}", {"value": step[2]}
        response = await async_client.put(url, json=body, headers=headers)
    elif kind == "undo":
        response = await async_client.post(f"/api/games/{game_id}/undo", json={}, headers=headers)
    else:
        raise ValueError(f"unknown step: {kind}")
    assert response.status_code == 200, response.text


async def _assert_log_replays_to_board(game_id: str) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with async_sessionmaker(engine)() as session:
            game = await session.get(Game, uuid.UUID(game_id))
            assert game is not None
            grid, notes = replay_events_to_state(game.puzzle, game.events, len(game.events))
            assert grid == game.current_grid
            assert notes == game.notes
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("steps", SCENARIOS.values(), ids=SCENARIOS.keys())
async def test_full_log_replays_to_the_board_after_every_step(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
    steps: list[tuple[Any, ...]],
) -> None:
    created = await async_client.post(
        "/api/games", json={"difficulty": "easy"}, headers=auth_headers
    )
    assert created.status_code == 201
    assert created.json()["puzzle"] == KNOWN_PUZZLE
    assert created.json()["assists"]["auto_clear_notes"] is True
    game_id = created.json()["id"]

    for step in steps:
        await _apply(async_client, auth_headers, game_id, step)
        await _assert_log_replays_to_board(game_id)
