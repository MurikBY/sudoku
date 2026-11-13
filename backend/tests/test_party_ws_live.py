import asyncio
import json
import socket
from collections.abc import AsyncIterator
from typing import Any

import pytest
import pytest_asyncio
import uvicorn
from httpx import AsyncClient
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed

from app.main import app
from app.services.party_ws_hub import LOBBY_CLOSED_CODE
from tests.fixtures import PARTY_ASSISTS

# A real uvicorn server, because an in-process ASGI client never runs uvicorn's protocol choice.
# Same protocol and frame cap as entrypoint.sh.
WS_PROTOCOL = "websockets-sansio"
WS_MAX_SIZE = 1024
STEP_TIMEOUT_SECONDS = 5


@pytest_asyncio.fixture
async def live_base_url(isolated_session_factory: Any) -> AsyncIterator[str]:
    # Listening before uvicorn starts, so early connections wait in the backlog.
    listener = socket.create_server(("127.0.0.1", 0))
    config = uvicorn.Config(
        app,
        ws=WS_PROTOCOL,
        ws_max_size=WS_MAX_SIZE,
        lifespan="off",
        log_level="warning",
    )
    server = uvicorn.Server(config)
    serving = asyncio.create_task(server.serve(sockets=[listener]))
    try:
        yield f"127.0.0.1:{listener.getsockname()[1]}"
    finally:
        server.should_exit = True
        await serving
        listener.close()


@pytest_asyncio.fixture
async def live_client(live_base_url: str) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(base_url=f"http://{live_base_url}") as client:
        yield client


async def _create_party(client: AsyncClient, host: dict[str, str]) -> dict[str, Any]:
    response = await client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": PARTY_ASSISTS},
        headers=host,
    )
    assert response.status_code == 201
    return response.json()


async def _join_party(client: AsyncClient, guest: dict[str, str], code: str) -> None:
    response = await client.post("/api/parties/join", json={"code": code}, headers=guest)
    assert response.status_code == 200


async def _socket_url(
    client: AsyncClient,
    base_url: str,
    party_id: str,
    member: dict[str, str],
) -> str:
    response = await client.post(f"/api/parties/{party_id}/ws-ticket", headers=member)
    assert response.status_code == 200
    return f"ws://{base_url}/api/ws/parties/{party_id}?ticket={response.json()['ticket']}"


async def _next_event(socket: ClientConnection) -> dict[str, Any]:
    async with asyncio.timeout(STEP_TIMEOUT_SECONDS):
        return json.loads(await socket.recv())


async def _close_code(socket: ClientConnection) -> int:
    async with asyncio.timeout(STEP_TIMEOUT_SECONDS):
        with pytest.raises(ConnectionClosed) as closed:
            await socket.recv()
    received = closed.value.rcvd
    assert received is not None
    return received.code


def _member_ids(event: dict[str, Any]) -> list[int]:
    return sorted(member["user_id"] for member in event["members"])


@pytest.mark.asyncio
async def test_socket_receives_snapshot_and_join(
    live_client: AsyncClient,
    live_base_url: str,
    init_data_for,
) -> None:
    host = init_data_for(811, "live_host")
    guest = init_data_for(812, "live_guest")
    party = await _create_party(live_client, host)

    async with connect(await _socket_url(live_client, live_base_url, party["id"], host)) as socket:
        snapshot = await _next_event(socket)
        assert snapshot["type"] == "members"
        assert snapshot["party_id"] == party["id"]
        assert _member_ids(snapshot) == [811]

        await _join_party(live_client, guest, party["code"])
        joined = await _next_event(socket)
        assert joined["type"] == "members"
        assert _member_ids(joined) == [811, 812]


@pytest.mark.asyncio
async def test_replayed_ticket_is_closed_with_4401(
    live_client: AsyncClient,
    live_base_url: str,
    init_data_for,
) -> None:
    host = init_data_for(813, "live_host_b")
    party = await _create_party(live_client, host)
    url = await _socket_url(live_client, live_base_url, party["id"], host)

    async with connect(url) as first:
        assert (await _next_event(first))["type"] == "members"
    async with connect(url) as replayed:
        assert await _close_code(replayed) == 4401


@pytest.mark.asyncio
async def test_leaving_closes_only_the_leavers_socket(
    live_client: AsyncClient,
    live_base_url: str,
    init_data_for,
) -> None:
    host = init_data_for(814, "live_host_c")
    guest = init_data_for(815, "live_guest_c")
    party = await _create_party(live_client, host)
    await _join_party(live_client, guest, party["code"])

    host_url = await _socket_url(live_client, live_base_url, party["id"], host)
    guest_url = await _socket_url(live_client, live_base_url, party["id"], guest)
    async with connect(host_url) as host_socket, connect(guest_url) as guest_socket:
        await _next_event(host_socket)
        await _next_event(guest_socket)

        left = await live_client.post(f"/api/parties/{party['id']}/leave", headers=guest)
        assert left.status_code == 204

        assert await _close_code(guest_socket) == LOBBY_CLOSED_CODE
        remaining = await _next_event(host_socket)
        assert remaining["type"] == "members"
        assert _member_ids(remaining) == [814]


@pytest.mark.asyncio
async def test_cancel_sends_cancelled_then_closes_every_socket(
    live_client: AsyncClient,
    live_base_url: str,
    init_data_for,
) -> None:
    host = init_data_for(816, "live_host_d")
    guest = init_data_for(817, "live_guest_d")
    party = await _create_party(live_client, host)
    await _join_party(live_client, guest, party["code"])

    host_url = await _socket_url(live_client, live_base_url, party["id"], host)
    guest_url = await _socket_url(live_client, live_base_url, party["id"], guest)
    async with connect(host_url) as host_socket, connect(guest_url) as guest_socket:
        await _next_event(host_socket)
        await _next_event(guest_socket)

        cancelled = await live_client.post(f"/api/parties/{party['id']}/cancel", headers=host)
        assert cancelled.status_code == 204

        for socket in (host_socket, guest_socket):
            assert (await _next_event(socket))["type"] == "cancelled"
            assert await _close_code(socket) == LOBBY_CLOSED_CODE
