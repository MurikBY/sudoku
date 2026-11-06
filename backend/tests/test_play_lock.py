import os
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.services.play_lock_service import PLAY_LOCK_TTL, PlayLockedError


@pytest.mark.asyncio
async def test_play_lock_acquire_blocks_second_token(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    first = await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )
    assert first.status_code == 204

    second = await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-b"},
        headers=auth_headers,
    )
    assert second.status_code == 409
    assert second.json()["code"] == PlayLockedError.code
    assert second.json()["message"] == "Another device is playing on this account."

    renew = await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )
    assert renew.status_code == 204


@pytest.mark.asyncio
async def test_play_lock_create_game_requires_holder_token(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    locked = await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )
    assert locked.status_code == 204

    blocked = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert blocked.status_code == 409
    assert blocked.json()["code"] == PlayLockedError.code
    assert blocked.json()["message"] == "Another device is playing on this account."

    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers={**auth_headers, "X-Play-Lock-Token": "device-a"},
    )
    assert created.status_code == 201


@pytest.mark.asyncio
async def test_play_lock_heartbeat_rejects_foreign_token(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )

    foreign = await async_client.post(
        "/api/play-lock/heartbeat",
        json={"token": "device-b"},
        headers=auth_headers,
    )
    assert foreign.status_code == 409

    ok = await async_client.post(
        "/api/play-lock/heartbeat",
        json={"token": "device-a"},
        headers=auth_headers,
    )
    assert ok.status_code == 204


@pytest.mark.asyncio
async def test_play_lock_release_allows_other_device(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )
    released = await async_client.post(
        "/api/play-lock/release",
        json={"token": "device-a"},
        headers=auth_headers,
    )
    assert released.status_code == 204

    second = await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-b"},
        headers=auth_headers,
    )
    assert second.status_code == 204


@pytest.mark.asyncio
async def test_play_lock_expires_then_other_can_acquire(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )

    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    expired_at = datetime.now(UTC) - PLAY_LOCK_TTL - timedelta(seconds=1)
    async with session_factory() as session:
        await session.execute(
            text(
                "UPDATE users SET play_lock_expires_at = :expired "
                "WHERE play_lock_token = 'device-a'"
            ),
            {"expired": expired_at},
        )
        await session.commit()
    await engine.dispose()

    second = await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-b"},
        headers=auth_headers,
    )
    assert second.status_code == 204


@pytest.mark.asyncio
async def test_play_lock_status(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    idle = await async_client.get("/api/play-lock", headers=auth_headers)
    assert idle.status_code == 200
    assert idle.json() == {"locked": False, "is_holder": False}

    await async_client.post(
        "/api/play-lock/acquire",
        json={"token": "device-a"},
        headers=auth_headers,
    )

    holder = await async_client.get(
        "/api/play-lock",
        headers={**auth_headers, "X-Play-Lock-Token": "device-a"},
    )
    assert holder.json() == {"locked": True, "is_holder": True}

    other = await async_client.get(
        "/api/play-lock",
        headers={**auth_headers, "X-Play-Lock-Token": "device-b"},
    )
    assert other.json() == {"locked": True, "is_holder": False}
