import logging

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_ready_returns_200_when_database_answers(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_ready_returns_503_when_execute_raises_oserror(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def execute(*_args: object, **_kwargs: object) -> None:
        raise OSError("connection refused")

    monkeypatch.setattr(AsyncSession, "execute", execute)
    # Alembic's fileConfig disables loggers created before the migration runs.
    monkeypatch.setattr(logging.getLogger("app.api.health"), "disabled", False)
    with caplog.at_level(logging.ERROR, logger="app.api.health"):
        response = await async_client.get("/api/ready")
    assert response.status_code == 503
    assert response.json() == {
        "code": "unavailable",
        "message": "database is not reachable",
    }
    failures = [
        record
        for record in caplog.records
        if record.name == "app.api.health" and record.message == "readiness check failed"
    ]
    assert len(failures) == 1
    assert failures[0].exc_info is not None
    assert isinstance(failures[0].exc_info[1], OSError)
