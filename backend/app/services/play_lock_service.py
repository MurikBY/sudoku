from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services import clock
from app.services.errors import ConflictError

PLAY_LOCK_TTL = timedelta(seconds=30)


class PlayLockedError(ConflictError):
    def __init__(self) -> None:
        super().__init__("Another device is playing on this account.")


def _utcnow() -> datetime:
    return clock.utcnow()


def is_lock_active(user: User, now: datetime | None = None) -> bool:
    if user.play_lock_token is None or user.play_lock_expires_at is None:
        return False
    current = now if now is not None else _utcnow()
    return user.play_lock_expires_at > current


def lock_status(user: User, token: str | None) -> dict[str, bool]:
    active = is_lock_active(user)
    is_holder = active and token is not None and user.play_lock_token == token
    return {"locked": active, "is_holder": is_holder}


def _extend_lock(user: User, token: str) -> None:
    user.play_lock_token = token
    user.play_lock_expires_at = _utcnow() + PLAY_LOCK_TTL


async def _lock_user_row(session: AsyncSession, user_id: int) -> User:
    result = await session.execute(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True),
    )
    return result.scalar_one()


async def acquire_play_lock(session: AsyncSession, user: User, token: str) -> None:
    if not token:
        raise ValueError("play lock token is required")
    locked_user = await _lock_user_row(session, user.id)
    if is_lock_active(locked_user) and locked_user.play_lock_token != token:
        raise PlayLockedError
    _extend_lock(locked_user, token)
    await session.commit()
    user.play_lock_token = locked_user.play_lock_token
    user.play_lock_expires_at = locked_user.play_lock_expires_at


async def heartbeat_play_lock(session: AsyncSession, user: User, token: str) -> None:
    if not token:
        raise ValueError("play lock token is required")
    locked_user = await _lock_user_row(session, user.id)
    if not is_lock_active(locked_user) or locked_user.play_lock_token != token:
        raise PlayLockedError
    _extend_lock(locked_user, token)
    await session.commit()
    user.play_lock_token = locked_user.play_lock_token
    user.play_lock_expires_at = locked_user.play_lock_expires_at


async def release_play_lock(session: AsyncSession, user: User, token: str) -> None:
    if not token:
        raise ValueError("play lock token is required")
    locked_user = await _lock_user_row(session, user.id)
    if locked_user.play_lock_token != token:
        await session.commit()
        return
    locked_user.play_lock_token = None
    locked_user.play_lock_expires_at = None
    await session.commit()
    user.play_lock_token = None
    user.play_lock_expires_at = None


async def require_play_lock_allows(
    session: AsyncSession,
    user: User,
    token: str | None,
) -> None:
    locked_user = await _lock_user_row(session, user.id)
    if not is_lock_active(locked_user):
        return
    if token is not None and locked_user.play_lock_token == token:
        return
    raise PlayLockedError
