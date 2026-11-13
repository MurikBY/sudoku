import inspect
import json
import os
import uuid
from typing import cast

import pytest
import pytest_asyncio
from fastapi import WebSocket
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.websockets import WebSocketState

from app.api.ws_parties import party_websocket
from app.services.party.errors import PartyForbidden
from app.services.party_ws_hub import party_ws_hub
from app.services.party_ws_ticket import (
    TICKET_TTL_SECONDS,
    PartyWsTicketRejected,
    PartyWsTicketStore,
    party_ws_tickets,
)
from tests.fixtures import PARTY_ASSISTS


class _PartySocketProbe:
    def __init__(self) -> None:
        self.events: list[dict] = []
        self.close_code: int | None = None
        self.application_state = WebSocketState.CONNECTING

    async def accept(self) -> None:
        self.application_state = WebSocketState.CONNECTED

    async def close(self, code: int = 1000) -> None:
        self.application_state = WebSocketState.DISCONNECTED
        self.close_code = code

    async def send_text(self, payload: str) -> None:
        self.events.append(json.loads(payload))

    async def receive(self) -> dict[str, object]:
        return {"type": "websocket.disconnect", "code": 1000}


@pytest_asyncio.fixture
async def party_socket_sessions(monkeypatch: pytest.MonkeyPatch):
    engine = create_async_engine(os.environ["DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr("app.db.session_factory", factory)
    yield
    await engine.dispose()


async def _open_socket(party_id: uuid.UUID, ticket: str) -> _PartySocketProbe:
    probe = _PartySocketProbe()
    await party_websocket(cast(WebSocket, probe), party_id, ticket=ticket)
    return probe


def test_party_websocket_takes_ticket_not_init_data() -> None:
    parameters = inspect.signature(party_websocket).parameters
    assert "ticket" in parameters
    assert "initData" not in parameters


def test_party_ws_ticket_expires(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = {"now": 1_000.0}
    monkeypatch.setattr("app.services.party_ws_ticket._now", lambda: clock["now"])
    store = PartyWsTicketStore()
    party_id = uuid.uuid4()
    token = store.issue(party_id, 7)
    clock["now"] = 1_000.0 + TICKET_TTL_SECONDS
    with pytest.raises(PartyWsTicketRejected, match="expired"):
        store.consume(token, party_id)


def test_party_ws_ticket_mismatch_burns_token() -> None:
    store = PartyWsTicketStore()
    party_id = uuid.uuid4()
    other_party_id = uuid.uuid4()
    token = store.issue(party_id, 7)
    with pytest.raises(PartyWsTicketRejected, match="party mismatch"):
        store.consume(token, other_party_id)
    with pytest.raises(PartyWsTicketRejected, match="missing"):
        store.consume(token, party_id)


@pytest.mark.asyncio
async def test_init_data_is_not_a_party_ws_ticket(init_data_for) -> None:
    probe = await _open_socket(uuid.uuid4(), init_data_for()["X-Init-Data"])
    assert probe.close_code == 4401
    assert probe.events == []


@pytest.mark.asyncio
async def test_member_ws_ticket_is_single_use(
    async_client: AsyncClient,
    init_data_for,
    party_socket_sessions: None,
) -> None:
    host = init_data_for(801, "ws_host")
    outsider = init_data_for(802, "ws_outsider")
    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": PARTY_ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    party_id = uuid.UUID(create.json()["id"])

    denied = await async_client.post(f"/api/parties/{party_id}/ws-ticket", headers=outsider)
    assert denied.status_code == 403

    missing = await async_client.post(
        f"/api/parties/{uuid.uuid4()}/ws-ticket",
        headers=host,
    )
    assert missing.status_code == 404

    issued = await async_client.post(f"/api/parties/{party_id}/ws-ticket", headers=host)
    assert issued.status_code == 200
    token = issued.json()["ticket"]
    assert token != host["X-Init-Data"]

    opened = await _open_socket(party_id, token)
    assert opened.close_code is None
    assert opened.events[0]["type"] == "members"
    assert opened.events[0]["party_id"] == str(party_id)
    assert party_id not in party_ws_hub._rooms

    replayed = await _open_socket(party_id, token)
    assert replayed.close_code == 4401
    assert replayed.events == []


@pytest.mark.asyncio
async def test_ws_ticket_rejected_for_other_party(
    async_client: AsyncClient,
    init_data_for,
) -> None:
    host = init_data_for(803, "ws_host_b")
    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": PARTY_ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    party_id = uuid.UUID(create.json()["id"])
    issued = await async_client.post(f"/api/parties/{party_id}/ws-ticket", headers=host)
    assert issued.status_code == 200

    rejected = await _open_socket(uuid.uuid4(), issued.json()["ticket"])
    assert rejected.close_code == 4401
    assert rejected.events == []
    with pytest.raises(PartyWsTicketRejected, match="missing"):
        party_ws_tickets.consume(issued.json()["ticket"], party_id)


@pytest.mark.asyncio
async def test_member_gone_after_the_ticket_check_is_closed_with_4401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    party_id = uuid.uuid4()
    ticket = party_ws_tickets.issue(party_id, 804)
    reads: list[str] = []

    async def member_until_second_read(_session, _party_id, _user_id):
        reads.append("read")
        if len(reads) > 1:
            raise PartyForbidden(f"not a member of party: {party_id}")

    class _UnusedSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args) -> None:
            return None

    monkeypatch.setattr("app.api.ws_parties.get_party_for_member", member_until_second_read)
    monkeypatch.setattr("app.api.ws_parties.open_session", _UnusedSession)

    probe = await _open_socket(party_id, ticket)

    assert reads == ["read", "read"]
    assert probe.close_code == 4401
    assert probe.events == []
    assert party_id not in party_ws_hub._rooms
