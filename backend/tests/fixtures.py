import time

from app.models.enums import Difficulty
from app.services.archived_rating_totals import ArchivedRatingTotals
from scripts.dev_init_data import sign_init_data

# Deterministic pair: solution from empty-grid backtracking, then clues removed.
KNOWN_SOLUTION = "123456789456789123789123456214365897365897214897214365531642978642978531978531642"
KNOWN_PUZZLE = "000456789006789123000123456214365897365897214897214365531642978642978531978531642"

SHALLOW_HARD_PUZZLE = (
    "090200000200500007800619000000025800070800090001000003000030780700000200009002016"
)

# Made-up totals. The production seed stays in migration 018 only.
TEST_ARCHIVE: dict[Difficulty, ArchivedRatingTotals] = {
    Difficulty.easy: ArchivedRatingTotals(
        games_started=8,
        games_completed=5,
        clean_wins=3,
        clean_elapsed_sum=10,
    ),
    Difficulty.medium: ArchivedRatingTotals(
        games_started=5,
        games_completed=3,
        clean_wins=2,
        clean_elapsed_sum=7,
    ),
    Difficulty.hard: ArchivedRatingTotals(
        games_started=4,
        games_completed=3,
        clean_wins=2,
        clean_elapsed_sum=11,
    ),
}

PARTY_ASSISTS = {
    "pencil": True,
    "highlight_peers": False,
    "highlight_same_digit": True,
    "mistake_feedback": True,
    "dim_completed_digits": False,
    "unit_complete_animation": False,
    "auto_clear_notes": True,
    "sticky_digit": True,
}


def make_init_data(
    bot_token: str,
    user_id: int = 42,
    username: str = "tester",
    auth_date: int | None = None,
    *,
    omit_auth_date: bool = False,
) -> str:
    if omit_auth_date:
        return sign_init_data(bot_token, user_id, username, None)
    issued_at = int(time.time()) if auth_date is None else auth_date
    return sign_init_data(bot_token, user_id, username, issued_at)
