from datetime import UTC, datetime

import pytest
from game_flow import empty_cell_fills
from httpx import AsyncClient

from tests.fixtures import KNOWN_PUZZLE


def _use_real_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.clock.utcnow", lambda: datetime.now(UTC))


@pytest.mark.asyncio
async def test_create_game_returns_active_puzzle(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    response = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["difficulty"] == "easy"
    assert body["status"] == "in_progress"
    assert body["completion"] is None
    assert body["puzzle"] == KNOWN_PUZZLE
    assert body["current_grid"] == KNOWN_PUZZLE
    assert body["notes"] == {}
    assert body["undo_count"] == 0
    assert body["conflict_indices"] == []
    assert body["wrong_digit_indices"] == []
    assert "solution" not in body


@pytest.mark.asyncio
async def test_sync_elapsed_seconds_without_move(
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

    response = await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 125},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["elapsed_seconds"] == 125

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.status_code == 200
    assert stats.json()["total_play_seconds"] == 125

    again = await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 140},
        headers=auth_headers,
    )
    assert again.status_code == 200

    stats_after = await async_client.get("/api/stats", headers=auth_headers)
    assert stats_after.json()["total_play_seconds"] == 140


@pytest.mark.asyncio
async def test_complete_after_sync_does_not_double_count_play_time(
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

    await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 200},
        headers=auth_headers,
    )

    for index, value in empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{game_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200

    complete = await async_client.post(
        f"/api/games/{game_id}/complete",
        json={"elapsed_seconds": 300},
        headers=auth_headers,
    )
    assert complete.status_code == 200

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.json()["total_play_seconds"] == 300


@pytest.mark.asyncio
async def test_new_game_abandons_previous_in_progress(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    first = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    first_id = first.json()["id"]

    second = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert second.status_code == 201

    first_game = await async_client.get(f"/api/games/{first_id}", headers=auth_headers)
    assert first_game.json()["status"] == "abandoned"

    resumable = await async_client.get("/api/games/resumable", headers=auth_headers)
    assert resumable.json()["id"] == second.json()["id"]


@pytest.mark.asyncio
async def test_abandon_adds_elapsed_to_total_play_time(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    first = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    first_id = first.json()["id"]

    await async_client.patch(
        f"/api/games/{first_id}",
        json={"elapsed_seconds": 90},
        headers=auth_headers,
    )

    second = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert second.status_code == 201

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.status_code == 200
    stats_body = stats.json()
    assert stats_body["games_started"] == 2
    assert stats_body["total_play_seconds"] == 90


@pytest.mark.asyncio
async def test_new_game_abandons_any_previous_in_progress(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    easy = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    easy_id = easy.json()["id"]

    medium = await async_client.post(
        "/api/games",
        json={"difficulty": "medium"},
        headers=auth_headers,
    )
    assert medium.status_code == 201

    easy_game = await async_client.get(f"/api/games/{easy_id}", headers=auth_headers)
    assert easy_game.json()["status"] == "abandoned"

    resumable = await async_client.get("/api/games/resumable", headers=auth_headers)
    assert resumable.status_code == 200
    body = resumable.json()
    assert body["id"] == medium.json()["id"]
    assert body["difficulty"] == "medium"


@pytest.mark.asyncio
async def test_abandon_game_removes_from_resumable(
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

    await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 75},
        headers=auth_headers,
    )

    abandon = await async_client.post(
        f"/api/games/{game_id}/abandon",
        json={"elapsed_seconds": 75},
        headers=auth_headers,
    )
    assert abandon.status_code == 200
    assert abandon.json()["status"] == "abandoned"

    resumable = await async_client.get("/api/games/resumable", headers=auth_headers)
    assert resumable.json() is None

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.json()["total_play_seconds"] == 75


@pytest.mark.asyncio
async def test_sync_rejects_elapsed_seconds_above_seven_days(
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

    response = await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 10**10},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_sync_rejects_elapsed_seconds_beyond_game_age(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
    monkeypatch: pytest.MonkeyPatch,
):
    _use_real_clock(monkeypatch)
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    game_id = created.json()["id"]

    response = await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 60},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "elapsed_seconds exceeds the time since the game started"


@pytest.mark.asyncio
async def test_sync_accepts_elapsed_seconds_within_start_tolerance(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
    monkeypatch: pytest.MonkeyPatch,
):
    _use_real_clock(monkeypatch)
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    game_id = created.json()["id"]

    response = await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 5},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["elapsed_seconds"] == 5


@pytest.mark.asyncio
async def test_complete_keeps_larger_elapsed_when_request_is_smaller(
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

    synced = await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 100},
        headers=auth_headers,
    )
    assert synced.status_code == 200

    for index, value in empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{game_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200

    complete = await async_client.post(
        f"/api/games/{game_id}/complete",
        json={"elapsed_seconds": 40},
        headers=auth_headers,
    )
    assert complete.status_code == 200
    assert complete.json()["elapsed_seconds"] == 100
