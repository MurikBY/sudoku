import enum

# Explicit re-export: mypy rejects a plain import under no-implicit-reexport.
from app.services.sudoku.difficulty import Difficulty as Difficulty  # noqa: PLC0414


class GameStatus(enum.StrEnum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"


class PartyStatus(enum.StrEnum):
    waiting = "waiting"
    started = "started"
    cancelled = "cancelled"


class LessonRole(enum.StrEnum):
    taught = "taught"
    practice = "practice"
