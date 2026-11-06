from sqlalchemy import and_

from app.models.enums import Difficulty, GameStatus
from app.models.game import SCORED_GAME, Game

DIFFICULTIES = tuple(Difficulty)

CLEAN_WIN = and_(
    Game.status == GameStatus.completed,
    Game.mistakes_count == 0,
    Game.hints_count == 0,
    SCORED_GAME,
)
FINISHED = and_(
    Game.status.in_((GameStatus.completed, GameStatus.abandoned)),
    SCORED_GAME,
)
