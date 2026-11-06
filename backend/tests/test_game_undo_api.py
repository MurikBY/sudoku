import pytest
from httpx import AsyncClient

from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION
from tests.game_flow import save_assists


@pytest.mark.asyncio
async def test_placing_wrong_digit_again_counts_another_mistake(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    await save_assists(async_client, auth_headers, mistake_feedback=False)
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    assert created.json()["assists"]["mistake_feedback"] is False
    game_id = created.json()["id"]
    cell_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_value = int(KNOWN_SOLUTION[cell_index])
    wrong_value = 1 if correct_value != 1 else 2

    wrong = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 10},
        headers=auth_headers,
    )
    assert wrong.status_code == 200
    assert wrong.json()["mistakes_count"] == 1
    assert cell_index in wrong.json()["wrong_digit_indices"]

    fixed = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": correct_value, "elapsed_seconds": 11},
        headers=auth_headers,
    )
    assert fixed.status_code == 200
    assert fixed.json()["mistakes_count"] == 1
    assert cell_index not in fixed.json()["wrong_digit_indices"]

    restored = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={
            "value": wrong_value,
            "elapsed_seconds": 12,
        },
        headers=auth_headers,
    )
    assert restored.status_code == 200
    assert restored.json()["is_mistake"] is True
    assert restored.json()["mistakes_count"] == 2
    assert cell_index in restored.json()["wrong_digit_indices"]

    recount = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": 0, "elapsed_seconds": 13},
        headers=auth_headers,
    )
    assert recount.status_code == 200
    again = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 14},
        headers=auth_headers,
    )
    assert again.status_code == 200
    assert again.json()["mistakes_count"] == 3


@pytest.mark.asyncio
async def test_undo_restores_digit_and_auto_cleared_peer_notes(
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
    assert created.json()["assists"]["auto_clear_notes"] is True
    game_id = created.json()["id"]
    move_index = 0
    peer_with_extra = 1
    peer_only_digit = 2
    correct_value = int(KNOWN_SOLUTION[move_index])

    await async_client.put(
        f"/api/games/{game_id}/cells/{peer_with_extra}/notes",
        json={"digits": [correct_value, 5]},
        headers=auth_headers,
    )
    await async_client.put(
        f"/api/games/{game_id}/cells/{peer_only_digit}/notes",
        json={"digits": [correct_value]},
        headers=auth_headers,
    )
    move = await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}",
        json={"value": correct_value},
        headers=auth_headers,
    )
    assert move.status_code == 200
    assert move.json()["undo_count"] == 3
    assert move.json()["current_grid"][move_index] == str(correct_value)
    pencil_after_move = move.json()["pencil_count"]

    fetched = await async_client.get(f"/api/games/{game_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["undo_count"] == 3
    assert "flashed_cell_indices" not in fetched.json()

    undone = await async_client.post(
        f"/api/games/{game_id}/undo",
        json={"elapsed_seconds": 40},
        headers=auth_headers,
    )
    assert undone.status_code == 200
    body = undone.json()
    assert body["current_grid"][move_index] == "0"
    assert body["notes"][str(peer_with_extra)] == sorted([correct_value, 5])
    assert body["notes"][str(peer_only_digit)] == [correct_value]
    assert body["undo_count"] == 2
    assert body["pencil_count"] == pencil_after_move
    assert body["mistakes_count"] == 0
    assert body["elapsed_seconds"] == 40
    assert body["undone_cell_index"] == move_index
    assert set(body["flashed_cell_indices"]) == {
        move_index,
        peer_with_extra,
        peer_only_digit,
    }


@pytest.mark.asyncio
async def test_undo_restores_notes_without_pencil_count(
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

    noted = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}/notes",
        json={"digits": [1, 5, 9]},
        headers=auth_headers,
    )
    assert noted.status_code == 200
    assert noted.json()["undo_count"] == 1
    assert noted.json()["pencil_count"] == 1

    undone = await async_client.post(
        f"/api/games/{game_id}/undo",
        json={},
        headers=auth_headers,
    )
    assert undone.status_code == 200
    body = undone.json()
    assert str(cell_index) not in body["notes"]
    assert body["undo_count"] == 0
    assert body["pencil_count"] == 1
    assert body["undone_cell_index"] == cell_index
    assert body["flashed_cell_indices"] == [cell_index]


@pytest.mark.asyncio
async def test_undo_pops_last_notes_change_only(
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
    empty_indices = [index for index, char in enumerate(KNOWN_PUZZLE) if char == "0"]
    first_cell = empty_indices[0]
    second_cell = empty_indices[1]

    await async_client.put(
        f"/api/games/{game_id}/cells/{first_cell}/notes",
        json={"digits": [1]},
        headers=auth_headers,
    )
    await async_client.put(
        f"/api/games/{game_id}/cells/{second_cell}/notes",
        json={"digits": [2]},
        headers=auth_headers,
    )

    undone = await async_client.post(
        f"/api/games/{game_id}/undo",
        json={},
        headers=auth_headers,
    )
    assert undone.status_code == 200
    body = undone.json()
    assert body["notes"][str(first_cell)] == [1]
    assert str(second_cell) not in body["notes"]
    assert body["undo_count"] == 1
    assert body["undone_cell_index"] == second_cell


@pytest.mark.asyncio
async def test_undo_wrong_digit_does_not_recount_mistake(
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

    wrong = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}",
        json={"value": wrong_value, "elapsed_seconds": 10},
        headers=auth_headers,
    )
    assert wrong.status_code == 200
    assert wrong.json()["mistakes_count"] == 1
    assert wrong.json()["undo_count"] == 1

    undone = await async_client.post(
        f"/api/games/{game_id}/undo",
        json={"elapsed_seconds": 11},
        headers=auth_headers,
    )
    assert undone.status_code == 200
    body = undone.json()
    assert body["current_grid"][cell_index] == "0"
    assert body["mistakes_count"] == 1
    assert body["undo_count"] == 0
    assert cell_index not in body["wrong_digit_indices"]


@pytest.mark.asyncio
async def test_undo_empty_stack_returns_conflict(
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
    undone = await async_client.post(
        f"/api/games/{game_id}/undo",
        json={},
        headers=auth_headers,
    )
    assert undone.status_code == 409
    assert undone.json()["message"] == "nothing to undo"
