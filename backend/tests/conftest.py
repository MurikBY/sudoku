import asyncio
import os
import sys
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import asyncpg
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from tests.database_guard import is_test_database_url
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION, TEST_ARCHIVE, make_init_data


def _require_test_database_url() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if database_url is not None and is_test_database_url(database_url):
        return
    # pytest.exit and UsageError both print a traceback when raised while a conftest is imported.
    sys.stderr.write("DATABASE_URL must name a database ending in _test\n")
    raise SystemExit(2)


_require_test_database_url()

os.environ.setdefault("BOT_TOKEN", "123456:ABC-DEF")
os.environ.setdefault("DOMAIN", "sudoku.murik.dev")
os.environ.setdefault("WEBAPP_URL", "https://sudoku.murik.dev")
os.environ.setdefault("ALLOWED_ORIGINS", '["https://sudoku.murik.dev"]')
os.environ.setdefault("TELEGRAM_USE_POLLING", "false")
os.environ.setdefault("TELEGRAM_BOT_ENABLED", "false")
os.environ.setdefault("ADMIN_TELEGRAM_IDS", "")
os.environ.setdefault("TELEGRAM_WEBHOOK_SECRET", "test_webhook_secret")
os.environ.setdefault("PUZZLE_POOL_REFILL_ENABLED", "false")
os.environ.setdefault("PUZZLE_POOL_TARGET_SIZE", "0")

from app.config import settings  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enums import Difficulty  # noqa: E402
from app.models.rating_counter_archive import RatingCounterArchive  # noqa: E402
from app.services import auth  # noqa: E402
from app.services.pool_take_limit import PoolTakeLimit  # noqa: E402
from app.services.sudoku.carver import givens_count  # noqa: E402
from app.services.sudoku.puzzle import GeneratedPuzzle  # noqa: E402

app.state.bot = None
app.state.dispatcher = None


@pytest.fixture(autouse=True)
def fresh_pool_take_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.pool_take_limit.pool_take_limit",
        PoolTakeLimit(),
    )


@pytest.fixture(autouse=True)
def game_clock_one_day_ahead(monkeypatch):
    # started_at stays the real insert time, so existing tests can credit
    # an elapsed value in the same moment the game is created.
    monkeypatch.setattr(
        "app.services.clock.utcnow",
        lambda: datetime.now(UTC) + timedelta(days=1),
    )


@pytest.fixture
def bot_token(monkeypatch):
    token = "123456:ABC-DEF"
    monkeypatch.setenv("BOT_TOKEN", token)
    monkeypatch.setenv("DATABASE_URL", os.environ["DATABASE_URL"])

    monkeypatch.setattr(settings, "BOT_TOKEN", token)
    monkeypatch.setattr(settings, "PUZZLE_POOL_REFILL_ENABLED", False)
    monkeypatch.setattr(settings, "PUZZLE_POOL_TARGET_SIZE", 0)
    auth._secret_key.cache_clear()
    return token


@pytest.fixture
def auth_headers(bot_token):
    return {"X-Init-Data": make_init_data(bot_token)}


@pytest.fixture
def init_data_for(bot_token):
    def _make(user_id: int = 42, username: str = "tester") -> dict[str, str]:
        return {"X-Init-Data": make_init_data(bot_token, user_id=user_id, username=username)}

    return _make


@pytest.fixture
def mock_puzzle_generation(monkeypatch):
    def fake_generated(difficulty: Difficulty) -> GeneratedPuzzle:
        return GeneratedPuzzle(
            puzzle=KNOWN_PUZZLE,
            solution=KNOWN_SOLUTION,
            difficulty=difficulty,
            givens_count=givens_count(KNOWN_PUZZLE),
        )

    async def fake_take_puzzle(_session, difficulty: Difficulty):
        return fake_generated(difficulty)

    monkeypatch.setattr("app.services.puzzle_pool_service.take_puzzle", fake_take_puzzle)
    monkeypatch.setattr(
        "app.services.puzzle_pool_service.schedule_refill",
        lambda _difficulty: None,
    )


def _quote_postgres_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


async def _create_test_database_if_missing() -> None:
    database_url = os.environ["DATABASE_URL"]
    if not is_test_database_url(database_url):
        raise RuntimeError("DATABASE_URL must name a database ending in _test")
    url = make_url(database_url)
    database_name = url.database
    if database_name is None or url.host is None or url.username is None or url.port is None:
        raise RuntimeError("DATABASE_URL must include user, host, port, and a database name")
    connection = await asyncpg.connect(
        host=url.host,
        port=url.port,
        user=url.username,
        password=url.password,
        database="postgres",
    )
    try:
        exists = await connection.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            database_name,
        )
        if exists is None:
            quoted_name = _quote_postgres_identifier(database_name)
            await connection.execute(f"CREATE DATABASE {quoted_name}")
    finally:
        await connection.close()


@pytest.fixture(scope="session")
def prepare_test_database() -> None:
    # alembic/env.py calls asyncio.run, so this fixture cannot be async.
    asyncio.run(_create_test_database_if_missing())
    command.upgrade(Config("alembic.ini"), "head")


async def _truncate_tables(session: AsyncSession) -> None:
    await session.execute(
        text(
            "TRUNCATE TABLE party_members, puzzle_pool, games, parties, users "
            "RESTART IDENTITY CASCADE"
        ),
    )
    await session.execute(delete(RatingCounterArchive))
    for difficulty, totals in TEST_ARCHIVE.items():
        session.add(
            RatingCounterArchive(
                difficulty=difficulty,
                games_started=totals.games_started,
                games_completed=totals.games_completed,
                clean_wins=totals.clean_wins,
                clean_elapsed_sum=totals.clean_elapsed_sum,
            ),
        )
    await session.commit()


@pytest_asyncio.fixture
async def async_client(prepare_test_database: None) -> AsyncIterator[AsyncClient]:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as session:
            await _truncate_tables(session)

            async def override_get_session() -> AsyncIterator[AsyncSession]:
                yield session

            app.dependency_overrides[get_session] = override_get_session

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                yield client

            app.dependency_overrides.clear()
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def isolated_session_factory(prepare_test_database: None, monkeypatch):
    engine = create_async_engine(os.environ["DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            await _truncate_tables(session)
        monkeypatch.setattr("app.db.session_factory", factory)
        yield factory
    finally:
        await engine.dispose()
