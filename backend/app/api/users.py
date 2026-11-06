from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, DbSession
from app.schemas.preferences import UserPreferencesResponse, UserPreferencesUpdateRequest
from app.services.preferences_service import preferences_from_user, update_user_preferences
from app.services.user_reset_service import reset_user_play_data

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me/preferences", response_model=UserPreferencesResponse)
async def get_my_preferences(
    current_user: CurrentUser,
) -> UserPreferencesResponse:
    return preferences_from_user(current_user)


@router.put("/me/preferences", response_model=UserPreferencesResponse)
async def put_my_preferences(
    body: UserPreferencesUpdateRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> UserPreferencesResponse:
    return await update_user_preferences(session, current_user, body)


@router.post("/me/reset-play-data", status_code=204)
async def reset_my_play_data(
    current_user: CurrentUser,
    session: DbSession,
) -> Response:
    await reset_user_play_data(session, current_user)
    return Response(status_code=204)
