from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Difficulty
from app.models.user import User
from app.schemas.preferences import (
    GameAssistsPayload,
    UserPreferencesResponse,
    UserPreferencesUpdateRequest,
)

DEFAULT_ASSISTS = GameAssistsPayload(
    pencil=True,
    highlight_peers=True,
    highlight_same_digit=True,
    mistake_feedback=True,
    dim_completed_digits=True,
    unit_complete_animation=True,
    auto_clear_notes=True,
    sticky_digit=True,
)

DEFAULT_PREFERENCES = UserPreferencesResponse(
    difficulty=Difficulty.medium,
    assists=DEFAULT_ASSISTS,
    custom_assists=DEFAULT_ASSISTS,
)


def preferences_from_user(user: User) -> UserPreferencesResponse:
    raw = user.preferences
    if not raw:
        return DEFAULT_PREFERENCES.model_copy(deep=True)
    return UserPreferencesResponse.model_validate(raw)


async def update_user_preferences(
    session: AsyncSession,
    user: User,
    body: UserPreferencesUpdateRequest,
) -> UserPreferencesResponse:
    preferences = UserPreferencesResponse(
        difficulty=body.difficulty,
        assists=body.assists,
        custom_assists=body.custom_assists,
    )
    user.preferences = preferences.model_dump(mode="json")
    await session.commit()
    await session.refresh(user)
    return preferences
