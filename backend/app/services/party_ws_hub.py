from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.schemas.party import PartyWsEvent

logger = logging.getLogger(__name__)

# Broadcasts run inside the request that changed the lobby, so a stalled client must not hold it.
SOCKET_WRITE_TIMEOUT_SECONDS = 2.0
LOBBY_CLOSED_CODE = 1000


class PartyWsHub:
    def __init__(self) -> None:
        self._rooms: dict[UUID, dict[WebSocket, int]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, party_id: UUID, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms.setdefault(party_id, {})[websocket] = user_id

    async def disconnect(self, party_id: UUID, websocket: WebSocket) -> None:
        async with self._lock:
            self._forget(party_id, [websocket])

    async def broadcast(self, party_id: UUID, event: PartyWsEvent) -> None:
        async with self._lock:
            sockets = list(self._rooms.get(party_id, {}))
        await self._send_many(party_id, sockets, event.model_dump_json())

    async def send_to_user(self, party_id: UUID, user_id: int, event: PartyWsEvent) -> None:
        async with self._lock:
            sockets = self._user_sockets(party_id, user_id)
        await self._send_many(party_id, sockets, event.model_dump_json())

    async def send_to_socket(
        self,
        party_id: UUID,
        websocket: WebSocket,
        event: PartyWsEvent,
    ) -> None:
        await self._send_many(party_id, [websocket], event.model_dump_json())

    async def close_user(self, party_id: UUID, user_id: int) -> None:
        async with self._lock:
            sockets = self._user_sockets(party_id, user_id)
            self._forget(party_id, sockets)
        await asyncio.gather(*(_close_socket(websocket) for websocket in sockets))

    async def close_room(self, party_id: UUID) -> None:
        async with self._lock:
            sockets = list(self._rooms.pop(party_id, {}))
        await asyncio.gather(*(_close_socket(websocket) for websocket in sockets))

    def _user_sockets(self, party_id: UUID, user_id: int) -> list[WebSocket]:
        return [
            websocket
            for websocket, member_id in self._rooms.get(party_id, {}).items()
            if member_id == user_id
        ]

    def _forget(self, party_id: UUID, sockets: list[WebSocket]) -> None:
        room = self._rooms.get(party_id)
        if room is None:
            return
        for websocket in sockets:
            room.pop(websocket, None)
        if not room:
            del self._rooms[party_id]

    async def _send_many(
        self,
        party_id: UUID,
        sockets: list[WebSocket],
        payload: str,
    ) -> None:
        delivered = await asyncio.gather(*(_send_text(websocket, payload) for websocket in sockets))
        stale = [websocket for websocket, ok in zip(sockets, delivered, strict=True) if not ok]
        if stale:
            async with self._lock:
                self._forget(party_id, stale)


async def _send_text(websocket: WebSocket, payload: str) -> bool:
    # Nothing awaits between this check and Starlette's own, so a concurrent close cannot slip in.
    if websocket.application_state is not WebSocketState.CONNECTED:
        return False
    try:
        async with asyncio.timeout(SOCKET_WRITE_TIMEOUT_SECONDS):
            await websocket.send_text(payload)
    except TimeoutError:
        logger.warning("party ws send timed out")
        return False
    except Exception:
        logger.exception("party ws send failed")
        return False
    return True


async def _close_socket(websocket: WebSocket) -> None:
    if websocket.application_state is not WebSocketState.CONNECTED:
        return
    try:
        async with asyncio.timeout(SOCKET_WRITE_TIMEOUT_SECONDS):
            await websocket.close(code=LOBBY_CLOSED_CODE)
    except TimeoutError:
        logger.warning("party ws close timed out")
    except Exception:
        logger.exception("party ws close failed")


party_ws_hub = PartyWsHub()
