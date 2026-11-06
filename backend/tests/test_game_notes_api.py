import pytest
from httpx import AsyncClient

from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION
from tests.game_flow import save_assists


@pytest.mark.asyncio
async def test_set_cell_notes_toggle_and_clear(
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
    cell_key = str(cell_index)

    response = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}/notes",
        json={"digits": [5, 1, 5, 9], "elapsed_seconds": 20},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["notes"][cell_key] == [1, 5, 9]
    assert body["elapsed_seconds"] == 20
    assert body["pencil_count"] == 1

    cleared = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}/notes",
        json={"digits": []},
        headers=auth_headers,
    )
    assert cleared.status_code == 200
    assert cell_key not in cleared.json()["notes"]
    assert cleared.json()["pencil_count"] == 2


@pytest.mark.asyncio
async def test_repeated_notes_do_not_count_another_pencil_mark(
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
    cell_key = str(cell_index)

    first = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}/notes",
        json={"digits": [5, 1, 9], "elapsed_seconds": 20},
        headers=auth_headers,
    )
    assert first.status_code == 200
    assert first.json()["notes"][cell_key] == [1, 5, 9]
    assert first.json()["pencil_count"] == 1
    assert first.json()["undo_count"] == 1
    assert first.json()["elapsed_seconds"] == 20

    repeated = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}/notes",
        json={"digits": [9, 1, 5], "elapsed_seconds": 24},
        headers=auth_headers,
    )
    assert repeated.status_code == 200
    body = repeated.json()
    assert body["notes"][cell_key] == [1, 5, 9]
    assert body["pencil_count"] == 1
    assert body["undo_count"] == 1
    assert body["elapsed_seconds"] == 24

    review = await async_client.get(f"/api/games/{game_id}/review", headers=auth_headers)
    assert review.status_code == 200
    notes_events = [event for event in review.json()["events"] if event["kind"] == "notes"]
    assert len(notes_events) == 1
    assert notes_events[0]["cell"] == cell_index
    assert notes_events[0]["notes"] == [1, 5, 9]


@pytest.mark.asyncio
async def test_set_cell_notes_rejects_given_and_filled(
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
    given_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char != "0")
    empty_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    correct_value = int(KNOWN_SOLUTION[empty_index])

    given_response = await async_client.put(
        f"/api/games/{game_id}/cells/{given_index}/notes",
        json={"digits": [1]},
        headers=auth_headers,
    )
    assert given_response.status_code == 400
    assert given_response.json()["message"] == "cannot note given cell"

    await async_client.put(
        f"/api/games/{game_id}/cells/{empty_index}",
        json={"value": correct_value},
        headers=auth_headers,
    )
    filled_response = await async_client.put(
        f"/api/games/{game_id}/cells/{empty_index}/notes",
        json={"digits": [1]},
        headers=auth_headers,
    )
    assert filled_response.status_code == 400


@pytest.mark.asyncio
async def test_move_clears_cell_notes_and_coach_hint_does_not(
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
    move_index = empty_indices[0]
    hint_index = empty_indices[1]
    move_key = str(move_index)
    hint_key = str(hint_index)

    await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}/notes",
        json={"digits": [2, 4]},
        headers=auth_headers,
    )
    await async_client.put(
        f"/api/games/{game_id}/cells/{hint_index}/notes",
        json={"digits": [3, 7]},
        headers=auth_headers,
    )

    move = await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}",
        json={"value": int(KNOWN_SOLUTION[move_index])},
        headers=auth_headers,
    )
    assert move.status_code == 200
    assert move_key not in move.json()["notes"]
    assert hint_key in move.json()["notes"]

    hint = await async_client.post(
        f"/api/games/{game_id}/hint",
        json={},
        headers=auth_headers,
    )
    assert hint.status_code == 200
    assert hint_key in hint.json()["notes"]
    assert hint.json()["notes"][hint_key] == [3, 7]
    assert hint.json()["current_grid"] == move.json()["current_grid"]


@pytest.mark.asyncio
async def test_move_auto_clears_digit_from_peer_notes(
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
    assert created.json()["assists"]["mistake_feedback"] is True
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
    notes = move.json()["notes"]
    assert notes[str(peer_with_extra)] == [5]
    assert str(peer_only_digit) not in notes

    review = await async_client.get(f"/api/games/{game_id}/review", headers=auth_headers)
    assert review.status_code == 200
    events = review.json()["events"]
    set_events = [event for event in events if event["kind"] == "set"]
    assert len(set_events) == 1
    assert set_events[0]["peer_notes"] == {
        str(peer_with_extra): [5],
        str(peer_only_digit): [],
    }
    assert sum(1 for event in events if event["kind"] == "notes") == 2


@pytest.mark.asyncio
async def test_move_skips_peer_note_clear_when_assist_off(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    await save_assists(async_client, auth_headers, auto_clear_notes=False)
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    assert created.json()["assists"]["auto_clear_notes"] is False
    assert created.json()["assists"]["mistake_feedback"] is True
    game_id = created.json()["id"]
    move_index = 0
    peer_index = 1
    correct_value = int(KNOWN_SOLUTION[move_index])

    await async_client.put(
        f"/api/games/{game_id}/cells/{peer_index}/notes",
        json={"digits": [correct_value, 5]},
        headers=auth_headers,
    )

    move = await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}",
        json={"value": correct_value},
        headers=auth_headers,
    )
    assert move.status_code == 200
    assert move.json()["notes"][str(peer_index)] == [correct_value, 5]


@pytest.mark.asyncio
async def test_mistake_keeps_peer_notes_when_mistake_feedback_on(
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
    assert created.json()["assists"]["mistake_feedback"] is True
    game_id = created.json()["id"]
    move_index = 0
    peer_index = 1
    correct_value = int(KNOWN_SOLUTION[move_index])
    wrong_value = 1 if correct_value != 1 else 2

    await async_client.put(
        f"/api/games/{game_id}/cells/{peer_index}/notes",
        json={"digits": [wrong_value, 5]},
        headers=auth_headers,
    )

    move = await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}",
        json={"value": wrong_value},
        headers=auth_headers,
    )
    assert move.status_code == 200
    assert move.json()["is_mistake"] is True
    assert move.json()["notes"][str(peer_index)] == [wrong_value, 5]


@pytest.mark.asyncio
async def test_mistake_clears_peer_notes_when_mistake_feedback_off(
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
    assert created.json()["assists"]["auto_clear_notes"] is True
    assert created.json()["assists"]["mistake_feedback"] is False
    game_id = created.json()["id"]
    move_index = 0
    peer_index = 1
    correct_value = int(KNOWN_SOLUTION[move_index])
    wrong_value = 1 if correct_value != 1 else 2

    await async_client.put(
        f"/api/games/{game_id}/cells/{peer_index}/notes",
        json={"digits": [wrong_value, 5]},
        headers=auth_headers,
    )

    move = await async_client.put(
        f"/api/games/{game_id}/cells/{move_index}",
        json={"value": wrong_value},
        headers=auth_headers,
    )
    assert move.status_code == 200
    assert move.json()["is_mistake"] is True
    assert move.json()["notes"][str(peer_index)] == [5]
