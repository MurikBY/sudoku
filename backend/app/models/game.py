from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer, String, and_
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import Difficulty, GameStatus

if TYPE_CHECKING:
    from app.models.user import User


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    party_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("parties.id"),
        index=True,
        nullable=True,
    )
    difficulty: Mapped[Difficulty] = mapped_column(Enum(Difficulty, name="difficulty"))
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus, name="game_status"))
    puzzle: Mapped[str] = mapped_column(String(81))
    solution: Mapped[str] = mapped_column(String(81))
    current_grid: Mapped[str] = mapped_column(String(81))
    mistakes_count: Mapped[int] = mapped_column(Integer, default=0)
    hints_count: Mapped[int] = mapped_column(Integer, default=0)
    pencil_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[dict[str, list[int]]] = mapped_column(JSONB, default=dict)
    undo_stack: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    events: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    assists: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    share_code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    is_analysis: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    analysis_source_game_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("games.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_lesson: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    lesson_technique: Mapped[str | None] = mapped_column(String, nullable=True)
    lesson_position_id: Mapped[str | None] = mapped_column(String, nullable=True)
    elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="games")


SCORED_GAME = and_(Game.is_analysis.is_(False), Game.is_lesson.is_(False))
