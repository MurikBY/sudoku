from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def upsert_telegram_user(
    session: AsyncSession,
    user_id: int,
    username: str | None,
) -> User:
    user = await session.get(User, user_id)
    if user is not None and user.username == username:
        return user

    statement = insert(User).values(id=user_id, username=username)
    rows = await session.scalars(
        statement.on_conflict_do_update(
            index_elements=[User.id],
            set_={"username": statement.excluded.username},
        )
        .returning(User)
        .execution_options(populate_existing=True),
    )
    user = rows.one()
    await session.commit()
    return user
