import os
from typing import Any

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.models import Base


def _schema_differences(connection: Connection) -> list[Any]:
    context = MigrationContext.configure(connection, opts={"compare_type": True})
    return list(compare_metadata(context, Base.metadata))


@pytest.mark.asyncio
async def test_migrations_build_the_schema_the_models_describe(
    prepare_test_database: None,
) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with engine.connect() as connection:
            differences = await connection.run_sync(_schema_differences)
    finally:
        await engine.dispose()
    assert differences == []
