import os
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.game import Game
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION
from tests.game_flow import save_assists


@pytest.mark.asyncio
async def test_move_cell_reports_mistake_and_increments_counter(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    game_id = created.json()["id"]
    cell_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_value = int(KNOWN_SOLUTION[cell_index])
    wrong_value = 1 if correct_value != 1 else 2

    response = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 10},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_mistake"] is True
    assert body["mistakes_count"] == 1
    assert cell_index in body["wrong_digit_indices"]

    reloaded = await async_client.get(f"/api/games/{game_id}", headers=auth_headers)
    assert reloaded.status_code == 200
    assert cell_index in reloaded.json()["wrong_digit_indices"]


@pytest.mark.asyncio
async def test_mistake_feedback_locks_correct_cell_from_overwrite(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    assert created.json()["assists"]["mistake_feedback"] is True
    game_id = created.json()["id"]
    cell_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_value = int(KNOWN_SOLUTION[cell_index])
    wrong_value = 1 if correct_value != 1 else 2

    placed = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": correct_value, "elapsed_seconds": 5},
        headers=auth_headers,
    )
    assert placed.status_code == 200
    assert placed.json()["mistakes_count"] == 0

    blocked = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 6},
        headers=auth_headers,
    )
    assert blocked.status_code == 400
    game = await async_client.get(f"/api/games/{game_id}", headers=auth_headers)
    assert game.json()["mistakes_count"] == 0
    assert game.json()["current_grid"][cell_index] == str(correct_value)

    cleared = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": 0, "elapsed_seconds": 7},
        headers=auth_headers,
    )
    assert cleared.status_code == 400

    await save_assists(async_client, auth_headers, mistake_feedback=False)
    unlocked = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert unlocked.status_code == 201
    assert unlocked.json()["assists"]["mistake_feedback"] is False
    unlocked_id = unlocked.json()["id"]

    placed_without_feedback = await async_client.put(
        f"/api/games/{unlocked_id}/cells/{cell_index}",
        json={"value": correct_value, "elapsed_seconds": 8},
        headers=auth_headers,
    )
    assert placed_without_feedback.status_code == 200

    allowed_without_feedback = await async_client.put(
        f"/api/games/{unlocked_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 9},
        headers=auth_headers,
    )
    assert allowed_without_feedback.status_code == 200
    assert allowed_without_feedback.json()["is_mistake"] is True
    assert allowed_without_feedback.json()["mistakes_count"] == 1


@pytest.mark.asyncio
async def test_mistake_feedback_allows_fixing_wrong_cell(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    assert created.json()["assists"]["mistake_feedback"] is True
    game_id = created.json()["id"]
    cell_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_value = int(KNOWN_SOLUTION[cell_index])
    wrong_value = 1 if correct_value != 1 else 2

    await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 5},
        headers=auth_headers,
    )
    fixed = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": correct_value, "elapsed_seconds": 6},
        headers=auth_headers,
    )
    assert fixed.status_code == 200
    assert fixed.json()["is_mistake"] is False
    assert fixed.json()["mistakes_count"] == 1
    assert cell_index not in fixed.json()["wrong_digit_indices"]


@pytest.mark.asyncio
async def test_move_cell_rejects_unknown_field(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    game_id = created.json()["id"]
    cell_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")

    response = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": 1, "count_mistake": False},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_repeated_wrong_digit_does_not_count_another_mistake(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    game_id = created.json()["id"]
    cell_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_value = int(KNOWN_SOLUTION[cell_index])
    wrong_value = 1 if correct_value != 1 else 2

    first = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 10},
        headers=auth_headers,
    )
    assert first.status_code == 200
    assert first.json()["is_mistake"] is True
    assert first.json()["mistakes_count"] == 1
    assert first.json()["undo_count"] == 1
    assert first.json()["elapsed_seconds"] == 10

    repeated = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 12},
        headers=auth_headers,
    )
    assert repeated.status_code == 200
    body = repeated.json()
    assert body["is_mistake"] is False
    assert body["mistakes_count"] == 1
    assert body["undo_count"] == 1
    assert body["elapsed_seconds"] == 12
    assert body["current_grid"][cell_index] == str(wrong_value)

    review = await async_client.get(f"/api/games/{game_id}/review", headers=auth_headers)
    assert review.status_code == 200
    set_events = [event for event in review.json()["events"] if event["kind"] == "set"]
    assert len(set_events) == 1
    assert set_events[0]["cell"] == cell_index
    assert set_events[0]["value"] == wrong_value


@pytest.mark.asyncio
async def test_repeated_correct_digit_keeps_restored_peer_note(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    game_id = created.json()["id"]
    move_index = 0
    peer_index = 1
    correct_value = int(KNOWN_SOLUTION[move_index])
    peer_key = str(peer_index)

    noted = await async_client.put(
        f"/api/games/{game_id}/cells/{peer_index}/notes",
        json={"digits": [correct_value]},
        headers=auth_headers,
    )
    assert noted.status_code == 200

    assert created.json()["assists"]["auto_clear_notes"] is True
    first = await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}",
        json={"value": correct_value, "elapsed_seconds": 10},
        headers=auth_headers,
    )
    assert first.status_code == 200
    assert peer_key not in first.json()["notes"]

    restored = await async_client.put(
        f"/api/games/{game_id}/cells/{peer_index}/notes",
        json={"digits": [correct_value]},
        headers=auth_headers,
    )
    assert restored.status_code == 200
    assert restored.json()["notes"][peer_key] == [correct_value]
    undo_count_after_restore = restored.json()["undo_count"]

    repeated = await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}",
        json={"value": correct_value, "elapsed_seconds": 12},
        headers=auth_headers,
    )
    assert repeated.status_code == 200
    assert repeated.json()["is_mistake"] is False
    assert repeated.json()["notes"][peer_key] == [correct_value]
    assert repeated.json()["undo_count"] == undo_count_after_restore
    assert repeated.json()["elapsed_seconds"] == 12


@pytest.mark.asyncio
async def test_move_is_rejected_once_the_game_log_is_full(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.game_events.MAX_GAME_EVENTS", 2)
    created = await async_client.post(
        "/api/games", json={"difficulty": "easy"}, headers=auth_headers
    )
    game_id = created.json()["id"]
    empty = [index for index, char in enumerate(KNOWN_PUZZLE) if char == "0"]

    for index in empty[:2]:
        accepted = await async_client.put(
            f"/api/games/{game_id}/cells/{index}",
            json={"value": int(KNOWN_SOLUTION[index])},
            headers=auth_headers,
        )
        assert accepted.status_code == 200

    rejected = await async_client.put(
        f"/api/games/{game_id}/cells/{empty[2]}",
        json={"value": int(KNOWN_SOLUTION[empty[2]])},
        headers=auth_headers,
    )
    assert rejected.status_code == 409
    assert rejected.json() == {
        "code": "game_log_full",
        "message": "this game already has 2 recorded moves",
    }
    # A fresh connection: the test client shares one session, which keeps the rolled-back edit.
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with async_sessionmaker(engine)() as session:
            stored = await session.get(Game, uuid.UUID(game_id))
            assert stored is not None
            assert stored.current_grid[empty[2]] == "0"
            assert len(stored.events) == 2
    finally:
        await engine.dispose()
