from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.services.sudoku.lessons.models import LESSON_TECHNIQUES
from app.services.sudoku.lessons.store import load_pool, taught_position
from tests.game_flow import save_assists


async def _start_lesson(
    async_client: AsyncClient,
    headers: dict[str, str],
    technique: str = "x_wing",
    variant: str = "taught",
):
    response = await async_client.post(
        "/api/games/lessons",
        json={"technique": technique, "variant": variant},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _complete_grid(
    async_client: AsyncClient,
    headers: dict[str, str],
    game_id: str,
    grid: str,
    solution: str,
    elapsed_seconds: int,
) -> dict:
    for index, (grid_digit, solution_digit) in enumerate(zip(grid, solution, strict=True)):
        if grid_digit != "0":
            continue
        move = await async_client.put(
            f"/api/games/{game_id}/cells/{index}",
            json={"value": int(solution_digit)},
            headers=headers,
        )
        assert move.status_code == 200
    complete = await async_client.post(
        f"/api/games/{game_id}/complete",
        json={"elapsed_seconds": elapsed_seconds},
        headers=headers,
    )
    assert complete.status_code == 200, complete.text
    return complete.json()


async def _solved_count(
    async_client: AsyncClient,
    headers: dict[str, str],
    technique: str,
) -> int:
    progress = await async_client.get("/api/games/lesson-progress", headers=headers)
    assert progress.status_code == 200, progress.text
    matched = next(item for item in progress.json()["items"] if item["technique"] == technique)
    return matched["solved_count"]


def _pencil_target(lesson_notes: dict[str, list[int]]) -> tuple[int, list[int]]:
    position = taught_position("pencil")
    issue = position.notes_issue
    if issue is None:
        raise AssertionError("pencil taught missing notes_issue")
    digits = list(issue.digits)
    if len(digits) < 2:
        raise AssertionError("pencil taught objective needs at least two digits")
    if set(digits) <= set(lesson_notes.get(str(issue.cell_index), [])):
        raise AssertionError("pencil taught already meets the objective")
    return issue.cell_index, digits


async def _put_notes(
    async_client: AsyncClient,
    headers: dict[str, str],
    game_id: str,
    cell_index: int,
    digits: list[int],
) -> dict:
    response = await async_client.put(
        f"/api/games/{game_id}/cells/{cell_index}/notes",
        json={"digits": digits},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def _use_real_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.clock.utcnow", lambda: datetime.now(UTC))


async def _undo_lesson(
    async_client: AsyncClient,
    headers: dict[str, str],
    game_id: str,
) -> dict:
    response = await async_client.post(
        f"/api/games/{game_id}/undo",
        json={},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_create_taught_lesson_uses_shared_snapshot(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    position = taught_position("x_wing")
    body = await _start_lesson(async_client, auth_headers)
    assert body["is_lesson"] is True
    assert body["is_analysis"] is False
    assert body["lesson_technique"] == "x_wing"
    assert body["lesson_position_id"] == position.id
    assert body["puzzle"] == position.grid
    assert body["current_grid"] == position.grid
    assert body["notes"] == position.notes
    assert body["completion"] is None
    assert body["lesson_objective_met"] is False
    assert body["lesson_role"] == "taught"
    assert body["lesson_has_practice"] is True


@pytest.mark.asyncio
async def test_taught_lesson_is_stable(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    first = await _start_lesson(async_client, auth_headers)
    second = await _start_lesson(async_client, auth_headers)
    assert first["lesson_position_id"] == second["lesson_position_id"] == "x_wing-01"
    assert first["puzzle"] == second["puzzle"]
    assert first["id"] != second["id"]


@pytest.mark.asyncio
async def test_practice_lesson_picks_from_pool(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    pool_ids = {position.id for position in load_pool("x_wing")}
    body = await _start_lesson(async_client, auth_headers, variant="practice")
    assert body["is_lesson"] is True
    assert body["lesson_position_id"] in pool_ids
    assert body["lesson_role"] in {"taught", "practice"}


@pytest.mark.asyncio
async def test_practice_lesson_excludes_current_position(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    first = await _start_lesson(async_client, auth_headers, variant="practice")
    response = await async_client.post(
        "/api/games/lessons",
        json={
            "technique": "x_wing",
            "variant": "practice",
            "exclude_position_id": first["lesson_position_id"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["lesson_position_id"] != first["lesson_position_id"]
    pool_ids = {position.id for position in load_pool("x_wing")}
    assert body["lesson_position_id"] in pool_ids


@pytest.mark.asyncio
async def test_starting_lesson_does_not_abandon_solo_or_touch_stats(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    solo = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    assert solo.status_code == 201
    solo_id = solo.json()["id"]

    lesson = await _start_lesson(async_client, auth_headers)
    still_solo = await async_client.get(f"/api/games/{solo_id}", headers=auth_headers)
    assert still_solo.json()["status"] == "in_progress"

    resumable = await async_client.get("/api/games/resumable", headers=auth_headers)
    assert resumable.json()["id"] == solo_id

    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.json()["games_started"] == 1
    assert stats.json()["games_completed"] == 0

    history = await async_client.get("/api/games/history", headers=auth_headers)
    history_ids = {item["id"] for item in history.json()["items"]}
    assert solo_id in history_ids
    assert lesson["id"] not in history_ids


@pytest.mark.asyncio
async def test_new_lesson_abandons_previous_lesson_only(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    mock_puzzle_generation: None,
):
    solo = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=auth_headers,
    )
    solo_id = solo.json()["id"]
    first = await _start_lesson(async_client, auth_headers)
    second = await _start_lesson(async_client, auth_headers, technique="naked_single")

    first_game = await async_client.get(f"/api/games/{first['id']}", headers=auth_headers)
    assert first_game.json()["status"] == "abandoned"
    second_game = await async_client.get(f"/api/games/{second['id']}", headers=auth_headers)
    assert second_game.json()["status"] == "in_progress"
    solo_game = await async_client.get(f"/api/games/{solo_id}", headers=auth_headers)
    assert solo_game.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_lesson_elapsed_and_complete_skip_stats(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    position = taught_position("naked_single")
    lesson = await _start_lesson(
        async_client,
        auth_headers,
        technique="naked_single",
    )
    synced = await async_client.patch(
        f"/api/games/{lesson['id']}",
        json={"elapsed_seconds": 120},
        headers=auth_headers,
    )
    assert synced.status_code == 204
    stats_during = await async_client.get("/api/stats", headers=auth_headers)
    assert stats_during.json()["total_play_seconds"] == 0
    assert stats_during.json()["games_started"] == 0

    completed = await _complete_grid(
        async_client,
        auth_headers,
        lesson["id"],
        position.grid,
        position.solution,
        elapsed_seconds=180,
    )
    assert completed["status"] == "completed"
    assert completed["completion"] is None
    stats = await async_client.get("/api/stats", headers=auth_headers)
    assert stats.json()["games_completed"] == 0
    assert stats.json()["games_started"] == 0
    assert stats.json()["total_play_seconds"] == 0


@pytest.mark.asyncio
async def test_taught_lesson_snapshot_omits_solution(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    position = taught_position("x_wing")
    response = await async_client.get(
        "/api/games/lessons/x_wing",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["technique"] == "x_wing"
    assert body["position_id"] == position.id
    assert body["grid"] == position.grid
    assert body["notes"] == position.notes
    assert body["has_practice"] is True
    assert body["step"] == (
        None if position.step is None else position.step.model_dump(mode="json")
    )
    assert body["notes_issue"] is None
    assert "solution" not in body
    assert "puzzle" not in body


@pytest.mark.asyncio
async def test_pencil_taught_snapshot_uses_notes_issue(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    position = taught_position("pencil")
    response = await async_client.get(
        "/api/games/lessons/pencil",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["position_id"] == position.id
    assert body["step"] is None
    assert body["notes_issue"] == (
        None if position.notes_issue is None else position.notes_issue.model_dump(mode="json")
    )
    assert body["has_practice"] is True


@pytest.mark.asyncio
async def test_taught_lesson_snapshot_unknown_technique_is_rejected(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    response = await async_client.get(
        "/api/games/lessons/jellyfish",
        headers=auth_headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_unknown_lesson_technique_is_rejected(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    response = await async_client.post(
        "/api/games/lessons",
        json={"technique": "jellyfish", "variant": "taught"},
        headers=auth_headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_lesson_review_by_code_is_hidden(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    lesson = await _start_lesson(async_client, auth_headers)
    review = await async_client.get(
        f"/api/games/by-code/{lesson['share_code']}",
        headers=auth_headers,
    )
    assert review.status_code == 404


@pytest.mark.asyncio
async def test_lesson_progress_starts_at_zero(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    response = await async_client.get("/api/games/lesson-progress", headers=auth_headers)
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [item["technique"] for item in items] == list(LESSON_TECHNIQUES)
    for item in items:
        assert item["solved_count"] == 0
        assert item["pool_size"] == len(load_pool(item["technique"]))


@pytest.mark.asyncio
async def test_meeting_lesson_objective_counts_progress_once(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    position = taught_position("naked_single")
    if position.step is None:
        raise AssertionError("naked_single taught missing step")
    await save_assists(async_client, auth_headers, mistake_feedback=False)
    lesson = await _start_lesson(
        async_client,
        auth_headers,
        technique="naked_single",
    )
    assert lesson["assists"]["mistake_feedback"] is False
    focus_index = position.step.focus_cells[0]
    digit = position.step.digit
    move = await async_client.put(
        f"/api/games/{lesson['id']}/cells/{focus_index}",
        json={"value": digit},
        headers=auth_headers,
    )
    assert move.status_code == 200, move.text
    assert move.json()["lesson_objective_met"] is True

    first = await async_client.get("/api/games/lesson-progress", headers=auth_headers)
    assert first.status_code == 200, first.text
    naked = next(item for item in first.json()["items"] if item["technique"] == "naked_single")
    assert naked["solved_count"] == 1
    assert naked["pool_size"] == len(load_pool("naked_single"))

    again = await async_client.put(
        f"/api/games/{lesson['id']}/cells/{focus_index}",
        json={"value": 0},
        headers=auth_headers,
    )
    assert again.status_code == 200
    restore = await async_client.put(
        f"/api/games/{lesson['id']}/cells/{focus_index}",
        json={"value": digit},
        headers=auth_headers,
    )
    assert restore.status_code == 200
    second = await async_client.get("/api/games/lesson-progress", headers=auth_headers)
    naked_again = next(
        item for item in second.json()["items"] if item["technique"] == "naked_single"
    )
    assert naked_again["solved_count"] == 1


@pytest.mark.asyncio
async def test_hint_blocks_lesson_progress(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    position = taught_position("naked_single")
    if position.step is None:
        raise AssertionError("naked_single taught missing step")
    lesson = await _start_lesson(
        async_client,
        auth_headers,
        technique="naked_single",
    )
    hint = await async_client.post(
        f"/api/games/{lesson['id']}/hint",
        json={"elapsed_seconds": 5},
        headers=auth_headers,
    )
    assert hint.status_code == 200, hint.text
    assert hint.json()["hints_count"] == 1

    focus_index = position.step.focus_cells[0]
    digit = position.step.digit
    move = await async_client.put(
        f"/api/games/{lesson['id']}/cells/{focus_index}",
        json={"value": digit},
        headers=auth_headers,
    )
    assert move.status_code == 200, move.text
    assert move.json()["lesson_objective_met"] is True
    assert move.json()["hints_count"] == 1

    progress = await async_client.get("/api/games/lesson-progress", headers=auth_headers)
    assert progress.status_code == 200, progress.text
    naked = next(item for item in progress.json()["items"] if item["technique"] == "naked_single")
    assert naked["solved_count"] == 0


@pytest.mark.asyncio
async def test_x_wing_elims_finish_the_lesson_without_counting_a_hint(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    position = taught_position("x_wing")
    if position.step is None or position.step.digit is None:
        raise AssertionError("x_wing taught missing an elimination digit")
    lesson = await _start_lesson(async_client, auth_headers)
    hint = await async_client.post(
        f"/api/games/{lesson['id']}/hint",
        json={"elapsed_seconds": 5},
        headers=auth_headers,
    )
    assert hint.status_code == 200, hint.text
    assert hint.json()["technique"] == "x_wing"

    digit = position.step.digit
    notes = {key: list(values) for key, values in lesson["notes"].items()}
    last = hint
    for index in position.step.elim_cells:
        key = str(index)
        remaining = [value for value in notes.get(key, []) if value != digit]
        last = await async_client.put(
            f"/api/games/{lesson['id']}/cells/{index}/notes",
            json={"digits": remaining, "elapsed_seconds": 6},
            headers=auth_headers,
        )
        assert last.status_code == 200, last.text
    assert last.json()["lesson_objective_met"] is True
    assert last.json()["hints_count"] == 1

    progress = await async_client.get("/api/games/lesson-progress", headers=auth_headers)
    assert progress.status_code == 200, progress.text
    x_wing = next(item for item in progress.json()["items"] if item["technique"] == "x_wing")
    assert x_wing["solved_count"] == 0


@pytest.mark.asyncio
async def test_lesson_uses_current_assists(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    current = await async_client.get("/api/users/me/preferences", headers=auth_headers)
    assert current.status_code == 200, current.text
    preferences = current.json()
    preferences["assists"]["sticky_digit"] = False
    preferences["custom_assists"]["sticky_digit"] = False
    saved = await async_client.put(
        "/api/users/me/preferences",
        json=preferences,
        headers=auth_headers,
    )
    assert saved.status_code == 200, saved.text

    lesson = await _start_lesson(async_client, auth_headers)
    assert lesson["assists"]["sticky_digit"] is False


@pytest.mark.asyncio
async def test_undo_drops_lesson_progress_until_the_objective_is_met_again(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    lesson = await _start_lesson(async_client, auth_headers, technique="pencil")
    cell_index, digits = _pencil_target(lesson["notes"])

    met = await _put_notes(async_client, auth_headers, lesson["id"], cell_index, digits)
    assert met["lesson_objective_met"] is True
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    cleared = await _undo_lesson(async_client, auth_headers, lesson["id"])
    assert cleared["lesson_objective_met"] is False
    assert await _solved_count(async_client, auth_headers, "pencil") == 0

    repeated = await _put_notes(async_client, auth_headers, lesson["id"], cell_index, digits)
    assert repeated["lesson_objective_met"] is True
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    partial = await _put_notes(
        async_client,
        auth_headers,
        lesson["id"],
        cell_index,
        digits[:-1],
    )
    assert partial["lesson_objective_met"] is False
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    again = await _put_notes(async_client, auth_headers, lesson["id"], cell_index, digits)
    assert again["lesson_objective_met"] is True
    assert await _solved_count(async_client, auth_headers, "pencil") == 1


@pytest.mark.asyncio
async def test_undo_inserts_lesson_progress_when_it_restores_the_objective(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    lesson = await _start_lesson(async_client, auth_headers, technique="pencil")
    cell_index, digits = _pencil_target(lesson["notes"])
    game_id = lesson["id"]

    await _put_notes(async_client, auth_headers, game_id, cell_index, digits)
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    removed = await _put_notes(async_client, auth_headers, game_id, cell_index, digits[:-1])
    assert removed["lesson_objective_met"] is False
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    restored = await _put_notes(async_client, auth_headers, game_id, cell_index, digits)
    assert restored["lesson_objective_met"] is True

    undone_restore = await _undo_lesson(async_client, auth_headers, game_id)
    assert undone_restore["lesson_objective_met"] is False
    assert await _solved_count(async_client, auth_headers, "pencil") == 0

    undone_removal = await _undo_lesson(async_client, auth_headers, game_id)
    assert undone_removal["lesson_objective_met"] is True
    assert await _solved_count(async_client, auth_headers, "pencil") == 1


@pytest.mark.asyncio
async def test_undo_on_a_later_attempt_keeps_progress_from_the_first(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
):
    # completed_at and started_at must share one clock. The autouse clock is a day
    # ahead of the column default, so the first attempt would look newer than the second.
    _use_real_clock(monkeypatch)
    first = await _start_lesson(async_client, auth_headers, technique="pencil")
    cell_index, digits = _pencil_target(first["notes"])
    met = await _put_notes(async_client, auth_headers, first["id"], cell_index, digits)
    assert met["lesson_objective_met"] is True
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    second = await _start_lesson(async_client, auth_headers, technique="pencil")
    assert second["id"] != first["id"]
    assert second["lesson_position_id"] == first["lesson_position_id"]

    scratch = await _put_notes(
        async_client,
        auth_headers,
        second["id"],
        cell_index,
        digits[:-1],
    )
    assert scratch["lesson_objective_met"] is False
    undone_scratch = await _undo_lesson(async_client, auth_headers, second["id"])
    assert undone_scratch["lesson_objective_met"] is False
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    repeated = await _put_notes(async_client, auth_headers, second["id"], cell_index, digits)
    assert repeated["lesson_objective_met"] is True
    assert await _solved_count(async_client, auth_headers, "pencil") == 1

    undone_repeat = await _undo_lesson(async_client, auth_headers, second["id"])
    assert undone_repeat["lesson_objective_met"] is False
    assert await _solved_count(async_client, auth_headers, "pencil") == 1
