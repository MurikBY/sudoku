from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import Difficulty


class PuzzlePoolEntry(Base):
    __tablename__ = "puzzle_pool"
    # take_puzzle reads the oldest row of a difficulty, and the refill counts one difficulty.
    __table_args__ = (Index("ix_puzzle_pool_difficulty_created_at", "difficulty", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    difficulty: Mapped[Difficulty] = mapped_column(
        Enum(Difficulty, name="difficulty", create_type=False),
    )
    puzzle: Mapped[str] = mapped_column(String(81), nullable=False)
    solution: Mapped[str] = mapped_column(String(81), nullable=False)
    givens_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
