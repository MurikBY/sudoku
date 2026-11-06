import pytest
from httpx import AsyncClient

DEFAULT_ASSISTS = {
    "pencil": True,
    "highlight_peers": True,
    "highlight_same_digit": True,
    "mistake_feedback": True,
    "dim_completed_digits": True,
    "unit_complete_animation": True,
    "auto_clear_notes": True,
    "sticky_digit": True,
}

FULL_ASSISTS = {
    "pencil": True,
    "highlight_peers": True,
    "highlight_same_digit": True,
    "mistake_feedback": True,
    "dim_completed_digits": True,
    "unit_complete_animation": True,
    "auto_clear_notes": True,
    "sticky_digit": True,
}


@pytest.mark.asyncio
async def test_get_preferences_returns_defaults(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    response = await async_client.get("/api/users/me/preferences", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["difficulty"] == "medium"
    assert body["assists"] == DEFAULT_ASSISTS
    assert body["custom_assists"] == DEFAULT_ASSISTS


@pytest.mark.asyncio
async def test_put_preferences_persists(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    payload = {
        "difficulty": "hard",
        "assists": FULL_ASSISTS,
        "custom_assists": DEFAULT_ASSISTS,
    }
    put_response = await async_client.put(
        "/api/users/me/preferences",
        json=payload,
        headers=auth_headers,
    )
    assert put_response.status_code == 200
    assert put_response.json() == payload

    get_response = await async_client.get("/api/users/me/preferences", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json() == payload


@pytest.mark.asyncio
async def test_put_preferences_rejects_invalid_payload(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    response = await async_client.put(
        "/api/users/me/preferences",
        json={
            "difficulty": "hard",
            "assists": {"pencil": True},
            "custom_assists": DEFAULT_ASSISTS,
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_preferences_require_auth(async_client: AsyncClient):
    response = await async_client.get("/api/users/me/preferences")
    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
    assert response.json()["message"] == "X-Init-Data header is missing"
