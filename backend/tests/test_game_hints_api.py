import pytest
from httpx import AsyncClient

from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION


@pytest.mark.asyncio
async def test_coach_hint_returns_notes_issue_without_changing_board(
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
    grid_before = created.json()["current_grid"]
    notes_before = created.json()["notes"]

    response = await async_client.post(
        f"/api/games/{game_id}/hint",
        json={"elapsed_seconds": 15},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "notes"
    assert body["notes_issue"] == "empty"
    assert body["technique"] is None
    assert body["current_grid"] == grid_before
    assert body["notes"] == notes_before
    assert body["hints_count"] == 1
    assert body["mistakes_count"] == 0
    assert body["undo_count"] == 0
    assert body["elapsed_seconds"] == 15
    assert body["focus_cells"]

    review = await async_client.get(f"/api/games/{game_id}/review", headers=auth_headers)
    assert review.status_code == 200
    assert all(event["kind"] != "hint" for event in review.json()["events"])

    second = await async_client.post(
        f"/api/games/{game_id}/hint",
        json={"elapsed_seconds": 18},
        headers=auth_headers,
    )
    assert second.status_code == 200
    assert second.json()["hints_count"] == 2
    assert second.json()["current_grid"] == grid_before


@pytest.mark.asyncio
async def test_coach_hint_reports_mistakes_before_technique(
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

    moved = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value},
        headers=auth_headers,
    )
    assert moved.status_code == 200
    grid_with_mistake = moved.json()["current_grid"]

    response = await async_client.post(
        f"/api/games/{game_id}/hint",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "mistake"
    assert body["technique"] is None
    assert cell_index in body["error_indices"]
    assert body["current_grid"] == grid_with_mistake
    assert body["hints_count"] == 1
