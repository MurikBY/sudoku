import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_game_history_filters_by_difficulty_and_status(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    easy = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert easy.status_code == 201
    medium = await async_client.post(
        "/api/games",
        json={"difficulty": "medium"},
        headers=auth_headers,
    )
    assert medium.status_code == 201

    all_games = await async_client.get("/api/games/history", headers=auth_headers)
    assert all_games.status_code == 200
    assert all_games.json()["total"] == 2

    easy_only = await async_client.get(
        "/api/games/history?difficulty=easy",
        headers=auth_headers,
    )
    assert easy_only.status_code == 200
    easy_body = easy_only.json()
    assert easy_body["total"] == 1
    assert easy_body["items"][0]["difficulty"] == "easy"
    assert easy_body["items"][0]["status"] == "abandoned"

    in_progress = await async_client.get(
        "/api/games/history?status=in_progress",
        headers=auth_headers,
    )
    assert in_progress.status_code == 200
    in_progress_body = in_progress.json()
    assert in_progress_body["total"] == 1
    assert in_progress_body["items"][0]["id"] == medium.json()["id"]

    none_match = await async_client.get(
        "/api/games/history?difficulty=easy&status=in_progress",
        headers=auth_headers,
    )
    assert none_match.status_code == 200
    assert none_match.json() == {"items": [], "total": 0}
