from typing import Annotated, cast

from aiogram import Bot, Dispatcher
from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.user import User
from app.services.auth import extract_user, parse_and_validate
from app.services.user_upsert import upsert_telegram_user


# Starlette stores these on an untyped State object.
def get_bot(request: Request) -> Bot | None:
    return cast(Bot | None, request.app.state.bot)


def get_dispatcher(request: Request) -> Dispatcher | None:
    return cast(Dispatcher | None, request.app.state.dispatcher)


async def get_current_user(
    x_init_data: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if x_init_data is None:
        raise HTTPException(status_code=401, detail="X-Init-Data header is missing")
    try:
        params = parse_and_validate(x_init_data)
        user_id, username = extract_user(params)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    return await upsert_telegram_user(session, user_id, username)


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_session)]
PlayLockHeader = Annotated[str | None, Header(alias="x-play-lock-token")]
