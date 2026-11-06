from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.models.enums import Difficulty, GameStatus, PartyStatus
from app.schemas.preferences import GameAssistsPayload
from app.schemas.strict_request import StrictRequest


class CreatePartyRequest(StrictRequest):
    difficulty: Difficulty
    assists: GameAssistsPayload


class StartPartyRequest(StrictRequest):
    difficulty: Difficulty


class UpdatePartyRequest(StrictRequest):
    difficulty: Difficulty


class JoinPartyRequest(StrictRequest):
    code: str = Field(min_length=4, max_length=6)


class PartyMemberResponse(BaseModel):
    user_id: int
    display_name: str
    is_host: bool
    joined_at: datetime
    game_id: uuid.UUID | None = None


class PartyResponse(BaseModel):
    id: uuid.UUID
    code: str
    host_user_id: int
    difficulty: Difficulty
    assists: GameAssistsPayload
    status: PartyStatus
    members: list[PartyMemberResponse]
    my_game_id: uuid.UUID | None = None
    created_at: datetime
    started_at: datetime | None = None


class StartPartyResponse(BaseModel):
    party: PartyResponse
    game_id: uuid.UUID


class PartyResultPlayer(BaseModel):
    user_id: int
    display_name: str
    status: GameStatus
    elapsed_seconds: int | None = None
    mistakes_count: int | None = None
    hints_count: int | None = None
    pencil_count: int | None = None
    game_id: uuid.UUID | None = None
    share_code: str | None = None


class PartyResultsResponse(BaseModel):
    id: uuid.UUID
    code: str
    started_at: datetime
    difficulty: Difficulty
    assists: GameAssistsPayload
    players: list[PartyResultPlayer]
    viewer_game_id: uuid.UUID | None = None


class PartyProgressPlayer(BaseModel):
    user_id: int
    display_name: str
    filled_cells: int
    status: GameStatus


class PartyProgressResponse(BaseModel):
    party_id: uuid.UUID
    total_cells: int
    players: list[PartyProgressPlayer]


class PartyWsTicketResponse(BaseModel):
    ticket: str


class PartyMembersEvent(BaseModel):
    type: Literal["members"]
    party_id: uuid.UUID
    status: PartyStatus
    difficulty: Difficulty
    members: list[PartyMemberResponse]


class PartyStartedEvent(BaseModel):
    type: Literal["started"]
    party_id: uuid.UUID
    game_id: uuid.UUID
    difficulty: Difficulty
    assists: GameAssistsPayload


class PartyCancelledEvent(BaseModel):
    type: Literal["cancelled"]
    party_id: uuid.UUID


PartyWsEvent = Annotated[
    PartyMembersEvent | PartyStartedEvent | PartyCancelledEvent,
    Field(discriminator="type"),
]
