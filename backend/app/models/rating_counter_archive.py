from sqlalchemy import Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import Difficulty


class RatingCounterArchive(Base):
    __tablename__ = "rating_counter_archive"

    difficulty: Mapped[Difficulty] = mapped_column(
        Enum(Difficulty, name="difficulty", create_type=False),
        primary_key=True,
    )
    games_started: Mapped[int] = mapped_column(Integer, nullable=False)
    games_completed: Mapped[int] = mapped_column(Integer, nullable=False)
    clean_wins: Mapped[int] = mapped_column(Integer, nullable=False)
    clean_elapsed_sum: Mapped[int] = mapped_column(Integer, nullable=False)
