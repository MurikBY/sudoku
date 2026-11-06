import pytest
from httpx import AsyncClient

from app.main import app
from tests.fixtures import KNOWN_SOLUTION


def _board_export_payload(game: dict, *, notes: dict[str, list[int]] | None = None) -> dict:
    return {
        "format": "sudoku-export-v1",
        "share_code": game["share_code"],
        "difficulty": game["difficulty"],
        "puzzle": game["puzzle"],
        "grid": game["current_grid"],
        "notes": notes or {},
        "board": "export-board",
    }


@pytest.mark.asyncio
async def test_export_puzzle_to_chat_sends_document(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    game = created.json()

    class FakeBot:
        def __init__(self) -> None:
            self.calls: list[tuple[int, str, str]] = []

        async def send_document(self, chat_id, document, caption):
            self.calls.append((chat_id, document.filename, caption))

    bot = FakeBot()
    app.state.bot = bot
    try:
        response = await async_client.post(
            "/api/games/export-to-chat",
            json=_board_export_payload(game, notes={"1": [2, 5]}),
            headers=auth_headers,
        )
    finally:
        app.state.bot = None

    assert response.status_code == 204
    assert bot.calls == [
        (42, f"sudoku-{game['share_code']}.json", f"Board export {game['share_code']}"),
    ]


@pytest.mark.asyncio
async def test_export_puzzle_to_chat_rejects_unknown_code(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    payload = _board_export_payload(created.json())
    payload["share_code"] = "ZZZZZZZZ"
    app.state.bot = object()
    try:
        response = await async_client.post(
            "/api/games/export-to-chat",
            json=payload,
            headers=auth_headers,
        )
    finally:
        app.state.bot = None
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_export_puzzle_to_chat_rejects_solution_field(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    payload = _board_export_payload(created.json())
    payload["solution"] = KNOWN_SOLUTION
    response = await async_client.post(
        "/api/games/export-to-chat",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_export_puzzle_to_chat_requires_bot(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    app.state.bot = None
    response = await async_client.post(
        "/api/games/export-to-chat",
        json=_board_export_payload(created.json()),
        headers=auth_headers,
    )
    assert response.status_code == 503
    assert response.json()["message"] == "telegram bot is not configured"
