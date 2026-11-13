import uuid

from fastapi import APIRouter, Query, WebSocket

from app.db import open_session
from app.services.party.errors import PartyForbidden, PartyNotFound
from app.services.party.events import party_members_event
from app.services.party.load import get_party_for_member
from app.services.party_ws_hub import party_ws_hub
from app.services.party_ws_ticket import PartyWsTicketRejected, party_ws_tickets

router = APIRouter(tags=["parties-ws"])


@router.websocket("/api/ws/parties/{party_id}")
async def party_websocket(
    websocket: WebSocket,
    party_id: uuid.UUID,
    ticket: str = Query(...),
) -> None:
    try:
        user_id = party_ws_tickets.consume(ticket, party_id)
        async with open_session() as session:
            await get_party_for_member(session, party_id, user_id)
    except (PartyWsTicketRejected, PartyNotFound, PartyForbidden):
        await websocket.accept()
        await websocket.close(code=4401)
        return

    await party_ws_hub.connect(party_id, user_id, websocket)
    try:
        async with open_session() as session:
            snapshot = party_members_event(
                await get_party_for_member(session, party_id, user_id),
            )
        await party_ws_hub.send_to_socket(party_id, websocket, snapshot)
        await _wait_for_disconnect(websocket)
    finally:
        await party_ws_hub.disconnect(party_id, websocket)


async def _wait_for_disconnect(websocket: WebSocket) -> None:
    # receive(), not receive_text(): the hub can close this socket from another request,
    # and receive_text() raises once the application side is closed.
    while (await websocket.receive())["type"] != "websocket.disconnect":
        continue
