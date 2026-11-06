from dataclasses import dataclass


@dataclass(frozen=True)
class ArchivedRatingTotals:
    games_started: int
    games_completed: int
    clean_wins: int
    clean_elapsed_sum: int


def add_archived_rating_totals(
    *,
    games_started: int,
    games_completed: int,
    clean_wins: int,
    clean_elapsed_sum: int,
    archive: ArchivedRatingTotals,
) -> tuple[int, int, int, int | None]:
    started = games_started + archive.games_started
    completed = games_completed + archive.games_completed
    clean = clean_wins + archive.clean_wins
    elapsed_sum = clean_elapsed_sum + archive.clean_elapsed_sum
    if clean == 0:
        if elapsed_sum != 0:
            raise RuntimeError("clean elapsed seconds without clean wins")
        return started, completed, clean, None
    return started, completed, clean, int(elapsed_sum / clean)
