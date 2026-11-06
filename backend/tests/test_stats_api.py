import os
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.models.enums import Difficulty
from app.services.archived_rating_totals import add_archived_rating_totals
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION, TEST_ARCHIVE


def _use_real_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.clock.utcnow", lambda: datetime.now(UTC))


def _empty_cell_fills() -> list[tuple[int, int]]:
    fills: list[tuple[int, int]] = []
    for index, (puzzle_char, solution_char) in enumerate(
        zip(KNOWN_PUZZLE, KNOWN_SOLUTION, strict=True),
    ):
        if puzzle_char == "0":
            fills.append((index, int(solution_char)))
    return fills


@pytest.mark.asyncio
async def test_stats_empty_user(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    response = await async_client.get("/api/stats", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["games_started"] == 0
    assert body["games_completed"] == 0
    assert body["clean_wins"] == 0
    assert body["win_rate"] is None
    assert body["clean_win_rate"] is None
    assert body["total_play_seconds"] == 0
    assert body["avg_completion_seconds"] is None
    assert body["avg_hints"] is None
    assert body["avg_pencil"] is None
    assert body["by_difficulty"]["easy"]["games_started"] == 0
    assert body["by_difficulty"]["easy"]["clean_wins"] == 0
    assert body["by_difficulty"]["easy"]["win_rate"] is None
    assert body["by_difficulty"]["easy"]["clean_win_rate"] is None
    assert body["by_difficulty"]["easy"]["avg_completion_seconds"] is None
    assert body["by_difficulty"]["easy"]["avg_hints"] is None
    assert body["by_difficulty"]["easy"]["avg_pencil"] is None
    assert body["by_difficulty"]["easy"]["best_time_clean_seconds"] is None
    assert body["by_difficulty"]["easy"]["avg_clean_seconds"] is None


@pytest.mark.asyncio
async def test_stats_avg_and_by_difficulty_after_completions(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    first = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    first_id = first.json()["id"]
    for index, value in _empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{first_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200
    complete_first = await async_client.post(
        f"/api/games/{first_id}/complete",
        json={"elapsed_seconds": 300},
        headers=auth_headers,
    )
    assert complete_first.status_code == 200

    second = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    second_id = second.json()["id"]
    for index, value in _empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{second_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200
    complete_second = await async_client.post(
        f"/api/games/{second_id}/complete",
        json={"elapsed_seconds": 600},
        headers=auth_headers,
    )
    assert complete_second.status_code == 200

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.status_code == 200
    body = stats.json()
    assert body["games_completed"] == 2
    assert body["clean_wins"] == 2
    assert body["win_rate"] == 1.0
    assert body["clean_win_rate"] == 1.0
    assert body["avg_completion_seconds"] == 450
    assert body["by_difficulty"]["easy"]["games_started"] == 2
    assert body["by_difficulty"]["easy"]["games_completed"] == 2
    assert body["by_difficulty"]["easy"]["clean_wins"] == 2
    assert body["by_difficulty"]["easy"]["win_rate"] == 1.0
    assert body["by_difficulty"]["easy"]["clean_win_rate"] == 1.0
    assert body["by_difficulty"]["easy"]["total_play_seconds"] == 900
    assert body["by_difficulty"]["easy"]["avg_completion_seconds"] == 450
    assert body["by_difficulty"]["easy"]["best_time_seconds"] == 300
    assert body["by_difficulty"]["easy"]["best_time_clean_seconds"] == 300
    assert body["by_difficulty"]["easy"]["avg_clean_seconds"] == 450
    assert body["avg_hints"] == 0.0
    assert body["avg_pencil"] == 0.0
    assert body["by_difficulty"]["easy"]["avg_hints"] == 0.0
    assert body["by_difficulty"]["easy"]["avg_pencil"] == 0.0
    assert body["by_difficulty"]["medium"]["games_started"] == 0


@pytest.mark.asyncio
async def test_stats_by_difficulty_includes_abandoned_play_time(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    first = await async_client.post(
        "/api/games",
        json={"difficulty": "medium"},
        headers=auth_headers,
    )
    first_id = first.json()["id"]
    await async_client.patch(
        f"/api/games/{first_id}",
        json={"elapsed_seconds": 90},
        headers=auth_headers,
    )

    second_medium = await async_client.post(
        "/api/games",
        json={"difficulty": "medium"},
        headers=auth_headers,
    )
    assert second_medium.status_code == 201

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.status_code == 200
    body = stats.json()
    assert body["total_play_seconds"] == 90
    assert body["by_difficulty"]["medium"]["games_started"] == 2
    assert body["by_difficulty"]["medium"]["games_completed"] == 0
    assert body["by_difficulty"]["medium"]["clean_wins"] == 0
    assert body["by_difficulty"]["medium"]["win_rate"] == 0.0
    assert body["by_difficulty"]["medium"]["clean_win_rate"] == 0.0
    assert body["by_difficulty"]["medium"]["total_play_seconds"] == 90
    assert body["by_difficulty"]["medium"]["avg_completion_seconds"] is None

    first_game = await async_client.get(f"/api/games/{first_id}", headers=auth_headers)
    assert first_game.json()["status"] == "abandoned"


@pytest.mark.asyncio
async def test_stats_include_in_progress_play_time(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    created = await async_client.post(
        "/api/games",
        json={"difficulty": "hard"},
        headers=auth_headers,
    )
    game_id = created.json()["id"]
    await async_client.patch(
        f"/api/games/{game_id}",
        json={"elapsed_seconds": 42},
        headers=auth_headers,
    )

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.status_code == 200
    body = stats.json()
    assert body["total_play_seconds"] == 42
    assert body["by_difficulty"]["hard"]["total_play_seconds"] == 42
    assert body["by_difficulty"]["hard"]["games_completed"] == 0


@pytest.mark.asyncio
async def test_stats_clean_wins_require_zero_mistakes_and_hints(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    clean = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    clean_id = clean.json()["id"]
    for index, value in _empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{clean_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200
    complete_clean = await async_client.post(
        f"/api/games/{clean_id}/complete",
        json={"elapsed_seconds": 300},
        headers=auth_headers,
    )
    assert complete_clean.status_code == 200

    with_mistake = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    mistake_id = with_mistake.json()["id"]
    wrong = await async_client.put(
        f"/api/games/{mistake_id}/cells/{_empty_cell_fills()[0][0]}",
        json={"value": 9 if _empty_cell_fills()[0][1] != 9 else 8},
        headers=auth_headers,
    )
    assert wrong.status_code == 200
    assert wrong.json()["mistakes_count"] == 1
    for index, value in _empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{mistake_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200
    complete_mistake = await async_client.post(
        f"/api/games/{mistake_id}/complete",
        json={"elapsed_seconds": 100},
        headers=auth_headers,
    )
    assert complete_mistake.status_code == 200

    with_hint = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    hint_id = with_hint.json()["id"]
    hinted = await async_client.post(
        f"/api/games/{hint_id}/hint",
        json={},
        headers=auth_headers,
    )
    assert hinted.status_code == 200
    assert hinted.json()["hints_count"] == 1
    for index, value in _empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{hint_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200
    complete_hint = await async_client.post(
        f"/api/games/{hint_id}/complete",
        json={"elapsed_seconds": 240},
        headers=auth_headers,
    )
    assert complete_hint.status_code == 200

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.status_code == 200
    body = stats.json()
    assert body["games_started"] == 3
    assert body["games_completed"] == 3
    assert body["clean_wins"] == 1
    assert body["win_rate"] == 1.0
    assert body["clean_win_rate"] == pytest.approx(1 / 3)
    assert body["by_difficulty"]["easy"]["clean_wins"] == 1
    assert body["by_difficulty"]["easy"]["win_rate"] == 1.0
    assert body["by_difficulty"]["easy"]["clean_win_rate"] == pytest.approx(1 / 3)
    assert body["by_difficulty"]["easy"]["best_time_seconds"] == 100
    assert body["by_difficulty"]["easy"]["best_time_clean_seconds"] == 300
    assert body["by_difficulty"]["easy"]["avg_clean_seconds"] == 300
    assert body["avg_hints"] == pytest.approx(1 / 3, abs=0.05)
    assert body["by_difficulty"]["easy"]["avg_hints"] == pytest.approx(1 / 3, abs=0.05)


async def _backdate_game_started_at(game_id: str, days_ago: int) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "UPDATE games SET started_at = NOW() - make_interval(days => :days) "
                    "WHERE id = CAST(:game_id AS uuid)",
                ),
                {"days": days_ago, "game_id": game_id},
            )
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_stats_period_filters_by_started_at(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
    monkeypatch: pytest.MonkeyPatch,
):
    recent = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    recent_id = recent.json()["id"]
    for index, value in _empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{recent_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200
    complete_recent = await async_client.post(
        f"/api/games/{recent_id}/complete",
        json={"elapsed_seconds": 200},
        headers=auth_headers,
    )
    assert complete_recent.status_code == 200

    old = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    old_id = old.json()["id"]
    for index, value in _empty_cell_fills():
        move = await async_client.put(
            f"/api/games/{old_id}/cells/{index}",
            json={"value": value},
            headers=auth_headers,
        )
        assert move.status_code == 200
    complete_old = await async_client.post(
        f"/api/games/{old_id}/complete",
        json={"elapsed_seconds": 400},
        headers=auth_headers,
    )
    assert complete_old.status_code == 200
    await _backdate_game_started_at(old_id, days_ago=10)
    # Completes above need the day-ahead clock so elapsed_seconds fits the game age.
    # The cutoff must match Postgres NOW(), which backdates started_at.
    _use_real_clock(monkeypatch)

    all_time = await async_client.get("/api/stats?period=all", headers=auth_headers)
    assert all_time.status_code == 200
    all_body = all_time.json()
    assert all_body["games_started"] == 2
    assert all_body["games_completed"] == 2
    assert all_body["avg_completion_seconds"] == 300

    week = await async_client.get("/api/stats?period=week", headers=auth_headers)
    assert week.status_code == 200
    week_body = week.json()
    assert week_body["games_started"] == 1
    assert week_body["games_completed"] == 1
    assert week_body["avg_completion_seconds"] == 200
    assert week_body["by_difficulty"]["easy"]["best_time_seconds"] == 200

    month = await async_client.get("/api/stats?period=month", headers=auth_headers)
    assert month.status_code == 200
    month_body = month.json()
    assert month_body["games_started"] == 2
    assert month_body["games_completed"] == 2

    await _backdate_game_started_at(old_id, days_ago=40)
    month_after = await async_client.get("/api/stats?period=month", headers=auth_headers)
    assert month_after.status_code == 200
    assert month_after.json()["games_started"] == 1
    assert month_after.json()["avg_completion_seconds"] == 200


@pytest.mark.asyncio
async def test_stats_rejects_unknown_period(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    response = await async_client.get("/api/stats?period=year", headers=auth_headers)
    assert response.status_code == 422


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


@pytest.mark.asyncio
async def test_clean_best_rating_top_ten_per_difficulty(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
):
    first = init_data_for(user_id=101, username="alpha")
    second = init_data_for(user_id=102, username="bravo")
    third = init_data_for(user_id=103, username="charlie")
    fourth = init_data_for(user_id=104, username="delta")

    await _complete_clean_game(
        async_client,
        first,
        difficulty="easy",
        elapsed_seconds=200,
    )
    await _complete_clean_game(
        async_client,
        second,
        difficulty="easy",
        elapsed_seconds=120,
    )
    await _complete_clean_game(
        async_client,
        third,
        difficulty="easy",
        elapsed_seconds=150,
    )
    await _complete_clean_game(
        async_client,
        fourth,
        difficulty="easy",
        elapsed_seconds=90,
    )
    await _complete_clean_game(
        async_client,
        first,
        difficulty="medium",
        elapsed_seconds=400,
    )
    started_only = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=first,
    )
    assert started_only.status_code == 201

    rating = await async_client.get("/api/stats/rating", headers=first)
    assert rating.status_code == 200
    body = rating.json()
    assert [entry["display_name"] for entry in body["easy"]["entries"]] == [
        "delta",
        "bravo",
        "charlie",
        "alpha",
    ]
    assert [entry["best_time_seconds"] for entry in body["easy"]["entries"]] == [
        90,
        120,
        150,
        200,
    ]
    assert [entry["rank"] for entry in body["easy"]["entries"]] == [1, 2, 3, 4]
    assert body["medium"]["entries"] == [
        {
            "rank": 1,
            "user_id": 101,
            "display_name": "alpha",
            "best_time_seconds": 400,
            "clean_games": 1,
        },
    ]
    assert body["hard"]["entries"] == []
    easy_archive = TEST_ARCHIVE[Difficulty.easy]
    medium_archive = TEST_ARCHIVE[Difficulty.medium]
    hard_archive = TEST_ARCHIVE[Difficulty.hard]
    easy_started, easy_completed, easy_clean, easy_avg = add_archived_rating_totals(
        games_started=5,
        games_completed=4,
        clean_wins=4,
        clean_elapsed_sum=560,
        archive=easy_archive,
    )
    medium_started, medium_completed, medium_clean, medium_avg = add_archived_rating_totals(
        games_started=1,
        games_completed=1,
        clean_wins=1,
        clean_elapsed_sum=400,
        archive=medium_archive,
    )
    hard_started, hard_completed, hard_clean, hard_avg = add_archived_rating_totals(
        games_started=0,
        games_completed=0,
        clean_wins=0,
        clean_elapsed_sum=0,
        archive=hard_archive,
    )
    assert body["easy"]["avg_clean_seconds"] == easy_avg
    assert body["medium"]["avg_clean_seconds"] == medium_avg
    assert body["hard"]["avg_clean_seconds"] == hard_avg
    assert body["easy"]["games_started"] == easy_started
    assert body["medium"]["games_started"] == medium_started
    assert body["hard"]["games_started"] == hard_started
    assert body["easy"]["games_completed"] == easy_completed
    assert body["medium"]["games_completed"] == medium_completed
    assert body["hard"]["games_completed"] == hard_completed
    assert body["easy"]["clean_wins"] == easy_clean
    assert body["medium"]["clean_wins"] == medium_clean
    assert body["hard"]["clean_wins"] == hard_clean


@pytest.mark.asyncio
async def test_clean_best_rating_orders_by_fastest_clean_time(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
):
    first = init_data_for(user_id=201, username="alpha")
    second = init_data_for(user_id=202, username="bravo")

    await _complete_clean_game(
        async_client,
        first,
        difficulty="easy",
        elapsed_seconds=100,
    )
    await _complete_clean_game(
        async_client,
        first,
        difficulty="easy",
        elapsed_seconds=300,
    )
    await _complete_clean_game(
        async_client,
        second,
        difficulty="easy",
        elapsed_seconds=150,
    )

    best = await async_client.get("/api/stats/rating", headers=first)
    assert best.status_code == 200
    best_body = best.json()
    assert [entry["display_name"] for entry in best_body["easy"]["entries"]] == ["alpha", "bravo"]
    assert [entry["best_time_seconds"] for entry in best_body["easy"]["entries"]] == [100, 150]
