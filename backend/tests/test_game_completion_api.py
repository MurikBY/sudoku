import pytest
from game_flow import (
    complete_easy_game,
    easy_rating_avg_clean_seconds,
    empty_cell_fills,
)
from httpx import AsyncClient

from tests.fixtures import KNOWN_PUZZLE


@pytest.mark.asyncio
async def test_complete_game_updates_stats(
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
    assert complete.json()["status"] == "completed"
    assert complete.json()["completion"] == {
        "clean": True,
        "your_avg_clean_seconds": 300,
        "global_avg_clean_seconds": easy_rating_avg_clean_seconds(300),
        "rating_rank": 1,
        "previous_rating_rank": None,
    }

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.status_code == 200
    stats_body = stats.json()
    assert stats_body["games_completed"] == 1
    assert stats_body["total_play_seconds"] == 300
    assert stats_body["by_difficulty"]["easy"]["best_time_seconds"] == 300


@pytest.mark.asyncio
async def test_complete_game_recap_compares_to_previous_runs(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    first = await complete_easy_game(async_client, auth_headers, 300)
    assert first["completion"] == {
        "clean": True,
        "your_avg_clean_seconds": 300,
        "global_avg_clean_seconds": easy_rating_avg_clean_seconds(300),
        "rating_rank": 1,
        "previous_rating_rank": None,
    }

    faster = await complete_easy_game(async_client, auth_headers, 200)
    assert faster["completion"] == {
        "clean": True,
        "your_avg_clean_seconds": 250,
        "global_avg_clean_seconds": easy_rating_avg_clean_seconds(300, 200),
        "rating_rank": 1,
        "previous_rating_rank": 1,
    }

    slower = await complete_easy_game(async_client, auth_headers, 400)
    assert slower["completion"] == {
        "clean": True,
        "your_avg_clean_seconds": 300,
        "global_avg_clean_seconds": easy_rating_avg_clean_seconds(300, 200, 400),
        "rating_rank": 1,
        "previous_rating_rank": 1,
    }


@pytest.mark.asyncio
async def test_complete_game_rating_rank_follows_clean_best_order(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
):
    first_user = init_data_for(user_id=42, username="first")
    second_user = init_data_for(user_id=99, username="second")
    first = await complete_easy_game(async_client, first_user, 300)
    second = await complete_easy_game(async_client, second_user, 200)
    assert first["completion"]["rating_rank"] == 1
    assert first["completion"]["previous_rating_rank"] is None
    assert second["completion"]["rating_rank"] == 1
    assert second["completion"]["previous_rating_rank"] is None

    improved = await complete_easy_game(async_client, first_user, 100)
    assert improved["completion"]["rating_rank"] == 1
    assert improved["completion"]["previous_rating_rank"] == 2


@pytest.mark.asyncio
async def test_complete_game_with_hints(
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

    hint = await async_client.post(
        f"/api/games/{game_id}/hint",
        json={},
        headers=auth_headers,
    )
    assert hint.status_code == 200
    assert hint.json()["current_grid"] == KNOWN_PUZZLE

    for index, value in empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{game_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200

    complete = await async_client.post(
        f"/api/games/{game_id}/complete",
        json={"elapsed_seconds": 200},
        headers=auth_headers,
    )
    assert complete.status_code == 200
    body = complete.json()
    assert body["status"] == "completed"
    assert body["hints_count"] == 1
    assert body["mistakes_count"] == 0
    assert body["completion"] == {
        "clean": False,
        "your_avg_clean_seconds": None,
        "global_avg_clean_seconds": easy_rating_avg_clean_seconds(),
        "rating_rank": None,
        "previous_rating_rank": None,
    }
