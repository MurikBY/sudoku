from httpx import AsyncClient

from app.models.enums import Difficulty
from app.services.archived_rating_totals import add_archived_rating_totals
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION, TEST_ARCHIVE


async def save_assists(
    async_client: AsyncClient,
    headers: dict[str, str],
    *,
    mistake_feedback: bool | None = None,
    auto_clear_notes: bool | None = None,
) -> None:
    current = await async_client.get("/api/users/me/preferences", headers=headers)
    assert current.status_code == 200, current.text
    preferences = current.json()
    assists = preferences["assists"]
    if mistake_feedback is not None:
        assists["mistake_feedback"] = mistake_feedback
    if auto_clear_notes is not None:
        assists["auto_clear_notes"] = auto_clear_notes
    saved = await async_client.put(
        "/api/users/me/preferences",
        json=preferences,
        headers=headers,
    )
    assert saved.status_code == 200, saved.text


def empty_cell_fills() -> list[tuple[int, int]]:
    fills: list[tuple[int, int]] = []
    for index, (puzzle_char, solution_char) in enumerate(
        zip(KNOWN_PUZZLE, KNOWN_SOLUTION, strict=True),
    ):
        if puzzle_char == "0":
            fills.append((index, int(solution_char)))
    return fills


def easy_rating_avg_clean_seconds(*live_clean_elapsed: int) -> int:
    archive = TEST_ARCHIVE[Difficulty.easy]
    _, _, _, avg = add_archived_rating_totals(
        games_started=len(live_clean_elapsed),
        games_completed=len(live_clean_elapsed),
        clean_wins=len(live_clean_elapsed),
        clean_elapsed_sum=sum(live_clean_elapsed),
        archive=archive,
    )
    if avg is None:
        raise RuntimeError("easy rating average missing")
    return avg


async def complete_easy_game(
    async_client: AsyncClient,
    headers: dict[str, str],
    elapsed_seconds: int,
) -> dict:
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=headers,
    )
    assert created.status_code == 201
    game_id = created.json()["id"]
    for index, value in empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{game_id}/cells/{index}",
            json={"value": value},
            headers=headers,
        )
        assert move.status_code == 200
    complete = await async_client.post(
        f"/api/games/{game_id}/complete",
        json={"elapsed_seconds": elapsed_seconds},
        headers=headers,
    )
    assert complete.status_code == 200
    return complete.json()
