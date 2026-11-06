from pydantic import BaseModel, ConfigDict

from app.models.enums import Difficulty
from app.schemas.strict_request import StrictRequest


class GameAssistsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pencil: bool
    highlight_peers: bool
    highlight_same_digit: bool
    mistake_feedback: bool
    dim_completed_digits: bool
    unit_complete_animation: bool
    auto_clear_notes: bool
    sticky_digit: bool


class UserPreferencesResponse(BaseModel):
    difficulty: Difficulty
    assists: GameAssistsPayload
    custom_assists: GameAssistsPayload


class UserPreferencesUpdateRequest(StrictRequest):
    difficulty: Difficulty
    assists: GameAssistsPayload
    custom_assists: GameAssistsPayload
