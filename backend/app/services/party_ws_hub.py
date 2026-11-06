from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import WebSocket

from app.schemas.party import PartyWsEvent

logger = logging.getLogger(__name__)


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
            sockets = self._rooms.get(party_id)
            if sockets is None:
                return
            sockets.pop(websocket, None)
            if not sockets:
                self._rooms.pop(party_id, None)

    async def broadcast(self, party_id: UUID, event: PartyWsEvent) -> None:
        payload = event.model_dump_json()
        async with self._lock:
            sockets = list(self._rooms.get(party_id, {}).keys())
        await self._send_many(party_id, sockets, payload)

    async def send_to_user(self, party_id: UUID, user_id: int, event: PartyWsEvent) -> None:
        payload = event.model_dump_json()
        async with self._lock:
            sockets = [
                websocket
                for websocket, member_id in self._rooms.get(party_id, {}).items()
                if member_id == user_id
            ]
        await self._send_many(party_id, sockets, payload)

    async def _send_many(
        self,
        party_id: UUID,
        sockets: list[WebSocket],
        payload: str,
    ) -> None:
        stale: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_text(payload)
            except Exception:
                logger.exception("party ws send failed")
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(party_id, websocket)


party_ws_hub = PartyWsHub()
