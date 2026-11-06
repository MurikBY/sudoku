import os
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import get_session
from app.main import app
from app.services.sudoku.carver import givens_count
from app.services.sudoku.puzzle import GeneratedPuzzle
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION

FULL_ASSISTS = {
    "pencil": True,
    "highlight_peers": True,
    "highlight_same_digit": True,
    "mistake_feedback": True,
    "dim_completed_digits": True,
    "unit_complete_animation": True,
    "auto_clear_notes": True,
    "sticky_digit": True,
}

PARTY_ASSISTS = {
    "pencil": True,
    "highlight_peers": False,
    "highlight_same_digit": True,
    "mistake_feedback": True,
    "dim_completed_digits": False,
    "unit_complete_animation": False,
    "auto_clear_notes": True,
    "sticky_digit": False,
}


def _empty_cell_fills() -> list[tuple[int, int]]:
    fills: list[tuple[int, int]] = []
    for index, (puzzle_char, solution_char) in enumerate(
        zip(KNOWN_PUZZLE, KNOWN_SOLUTION, strict=True),
    ):
        if puzzle_char == "0":
            fills.append((index, int(solution_char)))
    return fills


_RATING_TOTAL_FIELDS = (
    "avg_clean_seconds",
    "games_started",
    "games_completed",
    "clean_wins",
)


def _rating_totals(body: dict[str, dict[str, object]]) -> dict[str, dict[str, object]]:
    return {
        difficulty: {field: body[difficulty][field] for field in _RATING_TOTAL_FIELDS}
        for difficulty in ("easy", "medium", "hard")
    }


async def _complete_clean_game(
    async_client: AsyncClient,
    headers: dict[str, str],
    *,
    difficulty: str,
    elapsed_seconds: int,
) -> None:
    created = await async_client.post(
        "/api/games",
        json={"difficulty": difficulty},
        headers=headers,
    )
    assert created.status_code == 201
    game_id = created.json()["id"]
    for index, value in _empty_cell_fills():
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


@pytest.fixture
def mock_party_puzzle(monkeypatch: pytest.MonkeyPatch):
    def fake_generate(difficulty, rng=None, max_attempts=100):
        return GeneratedPuzzle(
            puzzle=KNOWN_PUZZLE,
            solution=KNOWN_SOLUTION,
            difficulty=difficulty,
            givens_count=givens_count(KNOWN_PUZZLE),
        )

    async def fake_take(_session, difficulty):
        return fake_generate(difficulty)

    monkeypatch.setattr("app.services.puzzle_pool_service.take_puzzle", fake_take)
    monkeypatch.setattr(
        "app.services.puzzle_pool_service.schedule_refill",
        lambda _difficulty: None,
    )


@pytest.mark.asyncio
async def test_reset_play_data_clears_games_rating_party_keeps_prefs(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
    mock_party_puzzle: None,
):
    player = init_data_for(user_id=901, username="reset_me")
    rival = init_data_for(user_id=902, username="stays")
    host = init_data_for(user_id=903, username="host_reset")

    prefs_payload = {
        "difficulty": "hard",
        "assists": FULL_ASSISTS,
        "custom_assists": FULL_ASSISTS,
    }
    put_prefs = await async_client.put(
        "/api/users/me/preferences",
        json=prefs_payload,
        headers=player,
    )
    assert put_prefs.status_code == 200

    await _complete_clean_game(
        async_client,
        player,
        difficulty="easy",
        elapsed_seconds=180,
    )
    await _complete_clean_game(
        async_client,
        rival,
        difficulty="easy",
        elapsed_seconds=90,
    )

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": PARTY_ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    party = create.json()
    join = await async_client.post(
        "/api/parties/join",
        json={"code": party["code"]},
        headers=player,
    )
    assert join.status_code == 200
    start = await async_client.post(
        f"/api/parties/{party['id']}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert start.status_code == 200

    before_stats = await async_client.get("/api/stats", headers=player)
    assert before_stats.status_code == 200
    assert before_stats.json()["games_started"] >= 1
    assert before_stats.json()["games_completed"] >= 1

    before_rating = await async_client.get("/api/stats/rating", headers=player)
    assert before_rating.status_code == 200
    before_rating_body = before_rating.json()
    assert any(entry["user_id"] == 901 for entry in before_rating_body["easy"]["entries"])
    rating_totals = _rating_totals(before_rating_body)

    before_history = await async_client.get("/api/games/history", headers=player)
    assert before_history.status_code == 200
    before_items = before_history.json()["items"]
    assert len([item for item in before_items if item["is_party"]]) == 1

    reset = await async_client.post("/api/users/me/reset-play-data", headers=player)
    assert reset.status_code == 204

    after_stats = await async_client.get("/api/stats", headers=player)
    assert after_stats.status_code == 200
    body = after_stats.json()
    assert body["games_started"] == 0
    assert body["games_completed"] == 0
    assert body["clean_wins"] == 0
    assert body["total_play_seconds"] == 0
    assert body["by_difficulty"]["easy"]["best_time_clean_seconds"] is None
    assert body["by_difficulty"]["easy"]["games_started"] == 0

    after_rating = await async_client.get("/api/stats/rating", headers=rival)
    assert after_rating.status_code == 200
    after_rating_body = after_rating.json()
    assert all(entry["user_id"] != 901 for entry in after_rating_body["easy"]["entries"])
    assert any(entry["user_id"] == 902 for entry in after_rating_body["easy"]["entries"])
    assert _rating_totals(after_rating_body) == rating_totals

    after_history = await async_client.get("/api/games/history", headers=player)
    assert after_history.status_code == 200
    assert after_history.json()["items"] == []

    host_results = await async_client.get(
        f"/api/parties/{party['id']}/results",
        headers=host,
    )
    assert host_results.status_code == 200
    players = host_results.json()["players"]
    assert len(players) == 1
    assert players[0]["display_name"] == "host_reset"

    prefs = await async_client.get("/api/users/me/preferences", headers=player)
    assert prefs.status_code == 200
    assert prefs.json() == prefs_payload

    resumable = await async_client.get("/api/games/resumable", headers=player)
    assert resumable.status_code == 200
    assert resumable.json() is None


async def _get_game_in_new_session(
    async_client: AsyncClient,
    game_id: str,
    headers: dict[str, str],
) -> Response:
    # The shared test session still holds the analysis game, so session.get
    # would skip the SELECT and keep the source id from before SET NULL.
    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    previous_get_session = app.dependency_overrides[get_session]

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    try:
        return await async_client.get(f"/api/games/{game_id}", headers=headers)
    finally:
        app.dependency_overrides[get_session] = previous_get_session
        await engine.dispose()


@pytest.mark.asyncio
async def test_reset_succeeds_when_another_player_analyzed_the_game(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
) -> None:
    owner = init_data_for(user_id=901, username="reset_owner")
    analyst = init_data_for(user_id=902, username="analyst")

    created = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=owner,
    )
    assert created.status_code == 201
    source = created.json()

    analysis = await async_client.post(
        "/api/games/analysis",
        json={"share_code": source["share_code"], "event_index": 0},
        headers=analyst,
    )
    assert analysis.status_code == 201
    analysis_body = analysis.json()
    assert analysis_body["analysis_source_game_id"] == source["id"]

    reset = await async_client.post("/api/users/me/reset-play-data", headers=owner)
    assert reset.status_code == 204

    loaded = await _get_game_in_new_session(async_client, analysis_body["id"], analyst)
    assert loaded.status_code == 200
    assert loaded.json()["analysis_source_game_id"] is None
