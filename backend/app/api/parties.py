import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, PlayLockHeader
from app.schemas.party import (
    CreatePartyRequest,
    JoinPartyRequest,
    PartyProgressResponse,
    PartyResponse,
    PartyResultsResponse,
    PartyWsTicketResponse,
    StartPartyRequest,
    StartPartyResponse,
    UpdatePartyRequest,
)
from app.services.party import load, lobby, start
from app.services.party.responses import get_party_progress, get_party_results, party_to_response
from app.services.party_ws_ticket import party_ws_tickets
from app.services.play_lock_service import require_play_lock_allows

router = APIRouter(prefix="/api/parties", tags=["parties"])


@router.post("", response_model=PartyResponse, status_code=201)
async def create_party(
    body: CreatePartyRequest,
    current_user: CurrentUser,
    session: DbSession,
    x_play_lock_token: PlayLockHeader = None,
) -> PartyResponse:
    await require_play_lock_allows(session, current_user, x_play_lock_token)
    party = await lobby.create_party(
        session,
        current_user,
        body.difficulty,
        body.assists,
    )
    return party_to_response(party, current_user.id)


@router.post("/join", response_model=PartyResponse)
async def join_party(
    body: JoinPartyRequest,
    current_user: CurrentUser,
    session: DbSession,
    x_play_lock_token: PlayLockHeader = None,
) -> PartyResponse:
    await require_play_lock_allows(session, current_user, x_play_lock_token)
    party = await lobby.join_party(session, current_user, body.code)
    return party_to_response(party, current_user.id)


@router.get("/current", response_model=PartyResponse | None)
async def get_current_party(
    current_user: CurrentUser,
    session: DbSession,
) -> PartyResponse | None:
    party = await load.get_current_party(session, current_user.id)
    if party is None:
        return None
    return party_to_response(party, current_user.id)


@router.post("/{party_id}/ws-ticket", response_model=PartyWsTicketResponse)
async def issue_party_ws_ticket(
    party_id: uuid.UUID,
    current_user: CurrentUser,
    session: DbSession,
) -> PartyWsTicketResponse:
    await load.get_party_for_member(session, party_id, current_user.id)
    ticket = party_ws_tickets.issue(party_id, current_user.id)
    return PartyWsTicketResponse(ticket=ticket)


@router.get("/{party_id}/results", response_model=PartyResultsResponse)
async def party_results(
    party_id: uuid.UUID,
    current_user: CurrentUser,
    session: DbSession,
) -> PartyResultsResponse:
    return await get_party_results(session, current_user.id, party_id)


@router.get("/{party_id}/progress", response_model=PartyProgressResponse)
async def party_progress(
    party_id: uuid.UUID,
    current_user: CurrentUser,
    session: DbSession,
) -> PartyProgressResponse:
    return await get_party_progress(session, current_user.id, party_id)


@router.patch("/{party_id}", response_model=PartyResponse)
async def update_party(
    party_id: uuid.UUID,
    body: UpdatePartyRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> PartyResponse:
    party = await lobby.update_party_difficulty(
        session,
        current_user,
        party_id,
        body.difficulty,
    )
    return party_to_response(party, current_user.id)


@router.post("/{party_id}/start", response_model=StartPartyResponse)
async def start_party(
    party_id: uuid.UUID,
    body: StartPartyRequest,
    current_user: CurrentUser,
    session: DbSession,
    x_play_lock_token: PlayLockHeader = None,
) -> StartPartyResponse:
    await require_play_lock_allows(session, current_user, x_play_lock_token)
    return await start.start_party(
        session,
        current_user,
        party_id,
        body.difficulty,
    )


@router.post("/{party_id}/leave", status_code=204)
async def leave_party(
    party_id: uuid.UUID,
    current_user: CurrentUser,
    session: DbSession,
) -> None:
    await lobby.leave_party(session, current_user, party_id)


@router.post("/{party_id}/cancel", status_code=204)
async def cancel_party(
    party_id: uuid.UUID,
    current_user: CurrentUser,
    session: DbSession,
) -> None:
    await lobby.cancel_party(session, current_user, party_id)
