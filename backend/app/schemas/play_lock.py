from pydantic import BaseModel, Field

from app.schemas.strict_request import StrictRequest


class PlayLockTokenRequest(StrictRequest):
    token: str = Field(min_length=1, max_length=128)


class PlayLockStatusResponse(BaseModel):
    locked: bool
    is_holder: bool
