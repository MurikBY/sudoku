from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, PlayLockHeader
from app.schemas.play_lock import PlayLockStatusResponse, PlayLockTokenRequest
from app.services.play_lock_service import (
    acquire_play_lock,
    heartbeat_play_lock,
    lock_status,
    release_play_lock,
)

router = APIRouter(prefix="/api/play-lock", tags=["play-lock"])


@router.get("", response_model=PlayLockStatusResponse)
async def get_play_lock_status(
    current_user: CurrentUser,
    x_play_lock_token: PlayLockHeader = None,
) -> PlayLockStatusResponse:
    return PlayLockStatusResponse(**lock_status(current_user, x_play_lock_token))


@router.post("/acquire", status_code=204)
async def acquire_lock(
    body: PlayLockTokenRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> None:
    await acquire_play_lock(session, current_user, body.token)


@router.post("/heartbeat", status_code=204)
async def heartbeat_lock(
    body: PlayLockTokenRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> None:
    await heartbeat_play_lock(session, current_user, body.token)


@router.post("/release", status_code=204)
async def release_lock(
    body: PlayLockTokenRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> None:
    await release_play_lock(session, current_user, body.token)
