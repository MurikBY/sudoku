from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import Difficulty, PartyStatus

if TYPE_CHECKING:
    from app.models.game import Game
    from app.models.user import User


class Party(Base):
    __tablename__ = "parties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(6), unique=True, index=True)
    host_user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    difficulty: Mapped[Difficulty] = mapped_column(
        Enum(Difficulty, name="difficulty", create_type=False),
    )
    assists: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[PartyStatus] = mapped_column(
        Enum(PartyStatus, name="party_status"),
        default=PartyStatus.waiting,
    )
    puzzle: Mapped[str | None] = mapped_column(String(81))
    solution: Mapped[str | None] = mapped_column(String(81))
    givens_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    host: Mapped[User] = relationship(foreign_keys=[host_user_id])
    members: Mapped[list[PartyMember]] = relationship(
        back_populates="party",
        cascade="all, delete-orphan",
    )


class PartyMember(Base):
    __tablename__ = "party_members"

    party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("parties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), primary_key=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    game_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("games.id"),
    )

    party: Mapped[Party] = relationship(back_populates="members")
    user: Mapped[User] = relationship()
    game: Mapped[Game | None] = relationship()
