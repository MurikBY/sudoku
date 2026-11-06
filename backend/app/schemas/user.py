from pydantic import BaseModel


class DifficultyStatsResponse(BaseModel):
    games_started: int
    games_completed: int
    clean_wins: int
    win_rate: float | None
    clean_win_rate: float | None
    total_play_seconds: int
    avg_completion_seconds: int | None
    best_time_seconds: int | None
    best_time_clean_seconds: int | None
    avg_clean_seconds: int | None
    avg_hints: float | None
    avg_pencil: float | None


class StatsByDifficultyResponse(BaseModel):
    easy: DifficultyStatsResponse
    medium: DifficultyStatsResponse
    hard: DifficultyStatsResponse


class UserStatsResponse(BaseModel):
    games_started: int
    games_completed: int
    clean_wins: int
    win_rate: float | None
    clean_win_rate: float | None
    total_play_seconds: int
    avg_completion_seconds: int | None
    avg_hints: float | None
    avg_pencil: float | None
    by_difficulty: StatsByDifficultyResponse


class CleanBestLeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    display_name: str
    best_time_seconds: int
    clean_games: int


class RatingDifficultyResponse(BaseModel):
    entries: list[CleanBestLeaderboardEntry]
    avg_clean_seconds: int | None
    games_started: int
    games_completed: int
    clean_wins: int


class CleanBestLeaderboardResponse(BaseModel):
    easy: RatingDifficultyResponse
    medium: RatingDifficultyResponse
    hard: RatingDifficultyResponse
