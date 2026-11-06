from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
SHARE_CODE_LENGTH = 8
PARTY_CODE_LENGTH = 6


async def allocate_unique_code(
    session: AsyncSession,
    column: InstrumentedAttribute[str],
    length: int,
) -> str:
    for _ in range(32):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))
        existing = await session.execute(select(column).where(column == code))
        if existing.scalar_one_or_none() is None:
            return code
    raise RuntimeError(f"failed to allocate {column}")
