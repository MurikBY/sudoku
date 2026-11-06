import uuid

from app.models.party import Party
from app.schemas.party import PartyCancelledEvent, PartyMembersEvent, PartyStartedEvent
from app.schemas.preferences import GameAssistsPayload
from app.services.party.responses import party_to_response


def party_members_event(party: Party) -> PartyMembersEvent:
    response = party_to_response(party, party.host_user_id)
    return PartyMembersEvent(
        type="members",
        party_id=party.id,
        status=party.status,
        difficulty=party.difficulty,
        members=response.members,
    )


def party_started_event(party: Party, game_id: uuid.UUID) -> PartyStartedEvent:
    return PartyStartedEvent(
        type="started",
        party_id=party.id,
        game_id=game_id,
        difficulty=party.difficulty,
        assists=GameAssistsPayload.model_validate(party.assists),
    )


def party_cancelled_event(party: Party) -> PartyCancelledEvent:
    return PartyCancelledEvent(type="cancelled", party_id=party.id)
