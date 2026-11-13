import asyncio
import uuid
from typing import cast

import pytest
from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.schemas.party import PartyCancelledEvent
from app.services.party_ws_hub import PartyWsHub


class _HubSocket:
    def __init__(self, *, stalls: bool) -> None:
        self.stalls = stalls
        self.payloads: list[str] = []
        self.application_state = WebSocketState.CONNECTING

    async def accept(self) -> None:
        self.application_state = WebSocketState.CONNECTED

    async def send_text(self, payload: str) -> None:
        if self.stalls:
            await asyncio.Event().wait()
        self.payloads.append(payload)


@pytest.mark.asyncio
async def test_stalled_socket_does_not_hold_up_the_room(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.party_ws_hub.SOCKET_WRITE_TIMEOUT_SECONDS", 0.05)
    hub = PartyWsHub()
    party_id = uuid.uuid4()
    stalled = _HubSocket(stalls=True)
    healthy = _HubSocket(stalls=False)
    await hub.connect(party_id, 1, cast(WebSocket, stalled))
    await hub.connect(party_id, 2, cast(WebSocket, healthy))
    event = PartyCancelledEvent(type="cancelled", party_id=party_id)

    async with asyncio.timeout(1):
        await hub.broadcast(party_id, event)

    assert healthy.payloads == [event.model_dump_json()]
    assert list(hub._rooms[party_id]) == [healthy]
