import asyncio

import pytest
from sqlalchemy import func, select

from app.models.user import User
from app.services.user_upsert import upsert_telegram_user


@pytest.mark.asyncio
async def test_concurrent_first_visit_creates_one_user(isolated_session_factory) -> None:
    user_id = 42

    async def create(username: str) -> User:
        async with isolated_session_factory() as session:
            return await upsert_telegram_user(session, user_id, username)

    first, second = await asyncio.gather(create("first"), create("second"))
    assert first.id == user_id
    assert second.id == user_id
    assert first.username == "first"
    assert second.username == "second"

    async with isolated_session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(User))
        stored = await session.get(User, user_id)

    assert count == 1
    assert stored is not None
    # Gather does not order the two commits; the row keeps whichever landed last.
    assert stored.username in {first.username, second.username}
    assert stored.preferences == {}
    assert stored.created_at.tzinfo is not None
