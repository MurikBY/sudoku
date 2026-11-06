from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.game import Game


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    preferences: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    play_lock_token: Mapped[str | None] = mapped_column(Text)
    play_lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    games: Mapped[list[Game]] = relationship(back_populates="user")
