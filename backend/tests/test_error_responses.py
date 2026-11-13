import uuid

import pytest
from httpx import AsyncClient

from app.main import app
from app.services.play_lock_service import PlayLockedError
from tests.fixtures import KNOWN_PUZZLE

ASSISTS = {
    "pencil": True,
    "highlight_peers": False,
    "highlight_same_digit": True,
    "mistake_feedback": True,
    "dim_completed_digits": False,
    "unit_complete_animation": False,
    "auto_clear_notes": True,
    "sticky_digit": True,
}


async def _create_easy_game(async_client: AsyncClient, headers: dict[str, str]) -> dict:
    response = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _board_export_payload(game: dict) -> dict:
    return {
        "format": "sudoku-export-v1",
        "share_code": game["share_code"],
        "difficulty": game["difficulty"],
        "puzzle": game["puzzle"],
        "grid": game["current_grid"],
        "notes": {},
        "board": "export-board",
    }


@pytest.mark.asyncio
async def test_missing_game_returns_not_found(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    game_id = uuid.uuid4()
    response = await async_client.get(f"/api/games/{game_id}", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["message"] == f"game not found: {game_id}"


@pytest.mark.asyncio
async def test_move_rejects_given_cell(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    game = await _create_easy_game(async_client, auth_headers)
    given_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char != "0")
    response = await async_client.put(
        f"/api/games/{game['id']}/cells/{given_index}",
        json={"value": 1},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "cannot modify given cell"


@pytest.mark.asyncio
async def test_complete_rejects_unsolved_grid(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    game = await _create_easy_game(async_client, auth_headers)
    response = await async_client.post(
        f"/api/games/{game['id']}/complete",
        json={"elapsed_seconds": 1},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "game grid does not match solution"


@pytest.mark.asyncio
async def test_sync_rejects_abandoned_game(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    game = await _create_easy_game(async_client, auth_headers)
    abandoned = await async_client.post(
        f"/api/games/{game['id']}/abandon",
        json={"elapsed_seconds": 1},
        headers=auth_headers,
    )
    assert abandoned.status_code == 200

    response = await async_client.patch(
        f"/api/games/{game['id']}",
        json={"elapsed_seconds": 1},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["message"] == f"game is not in progress: {game['id']}"


@pytest.mark.asyncio
async def test_analysis_rejects_own_in_progress_game(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    game = await _create_easy_game(async_client, auth_headers)
    response = await async_client.post(
        "/api/games/analysis",
        json={"share_code": game["share_code"], "event_index": 0},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "cannot analyze your own in-progress game"


@pytest.mark.asyncio
async def test_analysis_rejects_event_index_past_abandoned_game(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    game = await _create_easy_game(async_client, auth_headers)
    abandoned = await async_client.post(
        f"/api/games/{game['id']}/abandon",
        json={"elapsed_seconds": 1},
        headers=auth_headers,
    )
    assert abandoned.status_code == 200

    response = await async_client.post(
        "/api/games/analysis",
        json={"share_code": game["share_code"], "event_index": 99},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "event_count out of range"


@pytest.mark.asyncio
async def test_create_lesson_rejects_unknown_technique(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await async_client.post(
        "/api/games/lessons",
        json={"technique": "nope", "variant": "taught"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "unknown lesson technique: nope"


@pytest.mark.asyncio
async def test_taught_lesson_snapshot_rejects_unknown_technique(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await async_client.get("/api/games/lessons/nope", headers=auth_headers)
    assert response.status_code == 400
    assert response.json()["message"] == "unknown lesson technique: nope"


@pytest.mark.asyncio
async def test_review_by_unknown_code_returns_not_found(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await async_client.get("/api/games/by-code/ZZZZZZZZ", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["message"] == "game not found: ZZZZZZZZ"


@pytest.mark.asyncio
async def test_export_rejects_puzzle_that_differs_from_share_code(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    game = await _create_easy_game(async_client, auth_headers)
    payload = _board_export_payload(game)
    payload["puzzle"] = "1" + payload["puzzle"][1:]
    app.state.bot = object()
    try:
        response = await async_client.post(
            "/api/games/export-to-chat",
            json=payload,
            headers=auth_headers,
        )
    finally:
        app.state.bot = None
    assert response.status_code == 400
    assert response.json()["message"] == "puzzle does not match share_code"


@pytest.mark.asyncio
async def test_create_game_rejects_foreign_play_lock_token(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
) -> None:
    locked = await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )
    assert locked.status_code == 204

    response = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers={**auth_headers, "X-Play-Lock-Token": "other"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == PlayLockedError.code
    assert response.json()["message"] == "Another device is playing on this account."


@pytest.mark.asyncio
async def test_join_unknown_party_returns_not_found(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await async_client.post(
        "/api/parties/join",
        json={"code": "ZZZZZZ"},
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["message"] == "party not found: ZZZZZZ"


@pytest.mark.asyncio
async def test_waiting_party_results_are_not_available(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    created = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=auth_headers,
    )
    assert created.status_code == 201
    party_id = created.json()["id"]

    response = await async_client.get(
        f"/api/parties/{party_id}/results",
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["message"] == f"party results not available: {party_id}"


@pytest.mark.asyncio
async def test_invalid_body_returns_validation_error(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await async_client.post("/api/games", json={}, headers=auth_headers)
    assert response.status_code == 422
    body = response.json()
    assert body == {
        "code": "validation_error",
        "message": "Request validation failed",
        "fields": [{"loc": ["body", "difficulty"], "msg": "Field required"}],
    }


def test_openapi_validation_error_matches_the_handler() -> None:
    schema = app.openapi()
    again = app.openapi()
    assert again is schema
    components = schema["components"]["schemas"]
    assert "HTTPValidationError" not in components
    assert "ValidationError" not in components
    body = components["ValidationErrorResponse"]
    assert body["properties"]["code"]["const"] == "validation_error"
    assert body["properties"]["message"]["const"] == "Request validation failed"
    assert body["properties"]["fields"]["items"]["$ref"] == "#/components/schemas/ValidationField"
    field = components["ValidationField"]
    assert field["required"] == ["loc", "msg"]
    assert "input" not in field["properties"]
    saw_validation_response = False
    for path_item in schema["paths"].values():
        for method, operation in path_item.items():
            if method not in {"get", "put", "post", "delete", "options", "head", "patch", "trace"}:
                continue
            response = operation["responses"].get("422")
            if response is None:
                continue
            saw_validation_response = True
            ref = response["content"]["application/json"]["schema"]["$ref"]
            assert ref == "#/components/schemas/ValidationErrorResponse"
    assert saw_validation_response


@pytest.mark.asyncio
async def test_unreadable_body_returns_bad_request_before_auth(async_client: AsyncClient) -> None:
    response = await async_client.post(
        "/api/parties/join",
        content=b'{"code": "\xff"}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json() == {
        "code": "bad_request",
        "message": "There was an error parsing the body",
    }


@pytest.mark.asyncio
async def test_unknown_path_returns_not_found_code(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Not Found"}


@pytest.mark.asyncio
async def test_wrong_method_returns_method_not_allowed(async_client: AsyncClient) -> None:
    response = await async_client.post("/api/health")
    assert response.status_code == 405
    assert response.json() == {
        "code": "method_not_allowed",
        "message": "Method Not Allowed",
    }
    assert "GET" in response.headers["allow"]
