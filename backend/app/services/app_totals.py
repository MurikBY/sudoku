from dataclasses import dataclass

from sqlalchemy import func, select

from app.db import open_session
from app.models.enums import GameStatus
from app.models.game import SCORED_GAME, Game
from app.models.user import User


@dataclass(frozen=True)
class AppTotals:
    user_count: int
    games_started: int
    games_completed: int
    total_play_seconds: int


async def load_app_totals() -> AppTotals:
    async with open_session() as session:
        user_count = (await session.execute(select(func.count()).select_from(User))).scalar_one()
        game_row = (
            await session.execute(
                select(
                    func.count(),
                    func.count().filter(Game.status == GameStatus.completed),
                    func.coalesce(func.sum(Game.elapsed_seconds), 0),
                ).where(SCORED_GAME),
            )
        ).one()
    return AppTotals(
        user_count=user_count,
        games_started=game_row[0],
        games_completed=game_row[1],
        total_play_seconds=int(game_row[2]),
    )


def format_app_totals(totals: AppTotals) -> str:
    hours, minutes = divmod(totals.total_play_seconds // 60, 60)
    return (
        f"Users: {totals.user_count}\n"
        f"Games started: {totals.games_started}\n"
        f"Games completed: {totals.games_completed}\n"
        f"Play time: {hours}h {minutes}m"
    )
