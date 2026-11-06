import logging

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DbSession
from app.services.errors import UnavailableError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["health"])


# response_model=None keeps the OpenAPI body unchanged. The return type is for mypy.
@router.get("/health", response_model=None)
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", response_model=None)
async def ready(session: DbSession) -> dict[str, str]:
    try:
        await session.execute(text("SELECT 1"))
    except (OSError, SQLAlchemyError) as error:
        logger.exception("readiness check failed")
        raise UnavailableError("database is not reachable") from error
    return {"status": "ready"}
