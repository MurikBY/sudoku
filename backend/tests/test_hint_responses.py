import pytest
from httpx import AsyncClient

from app.services.sudoku.lessons.store import taught_position
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION


@pytest.mark.asyncio
async def test_mistake_hint_shape(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert created.status_code == 201
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

    response = await async_client.post(
        f"/api/games/{game_id}/hint",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "mistake"
    assert body["error_indices"]
    assert cell_index in body["error_indices"]
    assert body["technique"] is None
    assert body["house"] is None
    assert body["house_index"] is None
    assert body["outline_cells"] == []
    assert body["focus_cells"] == []
    assert body["elim_cells"] == []
    assert body["digit"] is None
    assert body["digits"] == []
    assert body["notes_issue"] is None


@pytest.mark.asyncio
async def test_notes_hint_shape(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    response = await async_client.post(
        f"/api/games/{game_id}/hint",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "notes"
    assert body["notes_issue"] == "empty"
    assert body["error_indices"] == []
    assert body["technique"] is None
    assert body["house"] is None
    assert body["house_index"] is None
    assert body["outline_cells"] == [0]
    assert body["focus_cells"] == [0]
    assert body["elim_cells"] == []
    assert body["digit"] is None
    assert body["digits"] == [1]


@pytest.mark.asyncio
async def test_taught_x_wing_hint_matches_lesson_step(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await async_client.post(
        "/api/games/lessons",
        json={"technique": "x_wing", "variant": "taught"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    response = await async_client.post(
        f"/api/games/{created.json()['id']}/hint",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    step = taught_position("x_wing").step
    if step is None:
        raise AssertionError("taught x_wing lesson has no step")
    assert body["kind"] == "technique"
    assert body["error_indices"] == []
    assert body["notes_issue"] is None
    assert body["technique"] == step.technique
    assert body["house"] == step.house
    assert body["house_index"] == step.house_index
    assert body["outline_cells"] == step.outline_cells
    assert body["focus_cells"] == step.focus_cells
    assert body["elim_cells"] == step.elim_cells
    assert body["digit"] == step.digit
    assert body["digits"] == step.digits
