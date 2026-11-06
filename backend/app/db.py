from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


def open_session() -> AsyncSession:
    return session_factory()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with open_session() as session:
        yield session
