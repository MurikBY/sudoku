import asyncio
import json
import os
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.background import drain
from app.main import app
from app.models.enums import Difficulty, GameStatus, PartyStatus
from app.models.game import Game
from app.models.party import Party, PartyMember
from app.models.user import User
from app.schemas.preferences import GameAssistsPayload
from app.services.party.errors import PartyForbidden, PartyNotWaiting
from app.services.party.events import (
    party_cancelled_event,
    party_members_event,
    party_started_event,
)
from app.services.party.limits import MAX_PARTY_SIZE
from app.services.party.load import get_party_for_member, load_party
from app.services.party.lobby import (
    cancel_party,
    create_party,
    join_party,
    leave_party,
    update_party_difficulty,
)
from app.services.party.responses import party_to_response
from app.services.party.start import start_party
from app.services.party_notify import build_completion_message
from app.services.sudoku.carver import givens_count
from app.services.sudoku.puzzle import GeneratedPuzzle
from app.services.user_upsert import upsert_telegram_user
from tests.fixtures import KNOWN_PUZZLE, KNOWN_SOLUTION

ASSISTS = {
    "pencil": True,
    "highlight_peers": False,
    "highlight_same_digit": True,
    "mistake_feedback": True,
    "dim_completed_digits": False,
    "unit_complete_animation": False,
    "auto_clear_notes": True,
    "sticky_digit": True,
}


@pytest.fixture
def party_headers(init_data_for):
    return init_data_for


def _fake_generate(difficulty, rng=None, max_attempts=100):
    return GeneratedPuzzle(
        puzzle=KNOWN_PUZZLE,
        solution=KNOWN_SOLUTION,
        difficulty=difficulty,
        givens_count=givens_count(KNOWN_PUZZLE),
    )


@pytest.fixture
def mock_party_puzzle(monkeypatch: pytest.MonkeyPatch):
    async def fake_take(_session, difficulty):
        return _fake_generate(difficulty)

    monkeypatch.setattr("app.services.puzzle_pool_service.take_puzzle", fake_take)
    monkeypatch.setattr(
        "app.services.puzzle_pool_service.schedule_refill",
        lambda _difficulty: None,
    )


@pytest.mark.asyncio
async def test_party_create_join_start_same_puzzle(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
):
    host = party_headers(101, "host")
    guest = party_headers(102, "guest")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    party = create.json()
    assert party["status"] == "waiting"
    assert len(party["code"]) == 6
    assert len(party["members"]) == 1

    join = await async_client.post(
        "/api/parties/join",
        json={"code": party["code"]},
        headers=guest,
    )
    assert join.status_code == 200
    assert len(join.json()["members"]) == 2

    start = await async_client.post(
        f"/api/parties/{party['id']}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert start.status_code == 200
    host_game_id = start.json()["game_id"]

    current_guest = await async_client.get("/api/parties/current", headers=guest)
    assert current_guest.status_code == 200
    guest_party = current_guest.json()
    assert guest_party["status"] == "started"
    guest_game_id = guest_party["my_game_id"]
    assert guest_game_id is not None
    assert guest_game_id != host_game_id

    host_game = await async_client.get(f"/api/games/{host_game_id}", headers=host)
    guest_game = await async_client.get(f"/api/games/{guest_game_id}", headers=guest)
    assert host_game.json()["puzzle"] == KNOWN_PUZZLE
    assert guest_game.json()["puzzle"] == KNOWN_PUZZLE
    assert host_game.json()["difficulty"] == "easy"
    assert guest_game.json()["difficulty"] == "easy"


@pytest.mark.asyncio
async def test_party_start_uses_start_difficulty_not_create(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
):
    host = party_headers(121, "host_diff")
    guest = party_headers(122, "guest_diff")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    party = create.json()
    join = await async_client.post(
        "/api/parties/join",
        json={"code": party["code"]},
        headers=guest,
    )
    assert join.status_code == 200

    start = await async_client.post(
        f"/api/parties/{party['id']}/start",
        json={"difficulty": "hard"},
        headers=host,
    )
    assert start.status_code == 200
    host_game_id = start.json()["game_id"]
    assert start.json()["party"]["difficulty"] == "hard"

    current_guest = await async_client.get("/api/parties/current", headers=guest)
    guest_game_id = current_guest.json()["my_game_id"]
    assert guest_game_id is not None
    host_game = await async_client.get(f"/api/games/{host_game_id}", headers=host)
    guest_game = await async_client.get(f"/api/games/{guest_game_id}", headers=guest)
    assert host_game.json()["difficulty"] == "hard"
    assert guest_game.json()["difficulty"] == "hard"


@pytest.mark.asyncio
async def test_party_host_updates_waiting_difficulty(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
):
    host = party_headers(131, "host_patch")
    guest = party_headers(132, "guest_patch")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    party_id = create.json()["id"]
    await async_client.post(
        "/api/parties/join",
        json={"code": create.json()["code"]},
        headers=guest,
    )

    updated = await async_client.patch(
        f"/api/parties/{party_id}",
        json={"difficulty": "hard"},
        headers=host,
    )
    assert updated.status_code == 200
    assert updated.json()["difficulty"] == "hard"

    guest_view = await async_client.get("/api/parties/current", headers=guest)
    assert guest_view.status_code == 200
    assert guest_view.json()["difficulty"] == "hard"

    forbidden = await async_client.patch(
        f"/api/parties/{party_id}",
        json={"difficulty": "medium"},
        headers=guest,
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["message"] == f"only host can update party: {party_id}"


@pytest.mark.asyncio
async def test_party_progress_lists_filled_cells(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
):
    host = party_headers(111, "progress_host")
    guest = party_headers(112, "progress_guest")
    outsider = party_headers(113, "outsider")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    party_id = create.json()["id"]
    code = create.json()["code"]

    waiting_progress = await async_client.get(
        f"/api/parties/{party_id}/progress",
        headers=host,
    )
    assert waiting_progress.status_code == 404

    await async_client.post("/api/parties/join", json={"code": code}, headers=guest)
    start = await async_client.post(
        f"/api/parties/{party_id}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert start.status_code == 200
    host_game_id = start.json()["game_id"]

    progress = await async_client.get(f"/api/parties/{party_id}/progress", headers=guest)
    assert progress.status_code == 200
    body = progress.json()
    assert body["party_id"] == party_id
    assert body["total_cells"] == 81
    assert len(body["players"]) == 2
    starting_filled = sum(1 for cell in KNOWN_PUZZLE if cell != "0")
    assert all(player["filled_cells"] == starting_filled for player in body["players"])
    assert {player["display_name"] for player in body["players"]} == {
        "progress_host",
        "progress_guest",
    }

    empty_index = next(index for index, char in enumerate(KNOWN_PUZZLE) if char == "0")
    move = await async_client.put(
        f"/api/games/{host_game_id}/cells/{empty_index}",
        json={"value": int(KNOWN_SOLUTION[empty_index])},
        headers=host,
    )
    assert move.status_code == 200

    after_move = await async_client.get(f"/api/parties/{party_id}/progress", headers=guest)
    assert after_move.status_code == 200
    by_name = {player["display_name"]: player for player in after_move.json()["players"]}
    assert by_name["progress_host"]["filled_cells"] == starting_filled + 1
    assert by_name["progress_guest"]["filled_cells"] == starting_filled
    assert after_move.json()["players"][0]["display_name"] == "progress_host"

    forbidden = await async_client.get(f"/api/parties/{party_id}/progress", headers=outsider)
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_party_join_rejected_after_start(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
):
    host = party_headers(201, "host2")
    late = party_headers(203, "late")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "medium", "assists": ASSISTS},
        headers=host,
    )
    party_id = create.json()["id"]
    code = create.json()["code"]

    started = await async_client.post(
        f"/api/parties/{party_id}/start",
        json={"difficulty": "medium"},
        headers=host,
    )
    assert started.status_code == 200

    join = await async_client.post(
        "/api/parties/join",
        json={"code": code},
        headers=late,
    )
    assert join.status_code == 409
    assert join.json()["message"] == f"party has already started: {party_id}"


@pytest.mark.asyncio
async def test_party_start_abandons_solo_only_then(
    async_client: AsyncClient,
    party_headers,
    mock_puzzle_generation: None,
    mock_party_puzzle: None,
):
    host = party_headers(301, "soloist")

    solo = await async_client.post(
        "/api/games",
        json={"difficulty": "hard"},
        headers=host,
    )
    assert solo.status_code == 201
    solo_id = uuid.UUID(solo.json()["id"])

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    assert create.status_code == 201

    still = await async_client.get("/api/games/resumable", headers=host)
    assert still.json()["id"] == str(solo_id)

    started = await async_client.post(
        f"/api/parties/{create.json()['id']}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert started.status_code == 200

    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            result = await session.execute(select(Game).where(Game.id == solo_id))
            abandoned = result.scalar_one()
            assert abandoned.status == GameStatus.abandoned
    finally:
        await engine.dispose()

    resumable = await async_client.get("/api/games/resumable", headers=host)
    assert resumable.json()["id"] == started.json()["game_id"]


@pytest.mark.asyncio
async def test_resumable_party_game_includes_host_assists(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
):
    host = party_headers(311, "host-assists")
    guest = party_headers(312, "guest-assists")

    solo = await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=guest,
    )
    assert solo.status_code == 201
    assert solo.json()["assists"] is not None

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    code = create.json()["code"]

    join = await async_client.post(
        "/api/parties/join",
        json={"code": code},
        headers=guest,
    )
    assert join.status_code == 200

    started = await async_client.post(
        f"/api/parties/{create.json()['id']}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert started.status_code == 200

    host_resumable = await async_client.get("/api/games/resumable", headers=host)
    assert host_resumable.status_code == 200
    assert host_resumable.json()["assists"] == ASSISTS
    assert host_resumable.json()["party_id"] == create.json()["id"]
    assert host_resumable.json()["id"] == started.json()["game_id"]

    guest_resumable = await async_client.get("/api/games/resumable", headers=guest)
    assert guest_resumable.status_code == 200
    assert guest_resumable.json()["assists"] == ASSISTS
    assert guest_resumable.json()["party_id"] == create.json()["id"]
    assert guest_resumable.json()["id"] is not None
    assert guest_resumable.json()["id"] != started.json()["game_id"]


@pytest.mark.asyncio
async def test_party_cancel_and_leave(
    async_client: AsyncClient,
    party_headers,
):
    host = party_headers(401, "host3")
    guest = party_headers(402, "guest3")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    party_id = create.json()["id"]
    code = create.json()["code"]

    await async_client.post("/api/parties/join", json={"code": code}, headers=guest)
    leave = await async_client.post(f"/api/parties/{party_id}/leave", headers=guest)
    assert leave.status_code == 204

    current = await async_client.get("/api/parties/current", headers=guest)
    assert current.json() is None

    cancel = await async_client.post(f"/api/parties/{party_id}/cancel", headers=host)
    assert cancel.status_code == 204

    current_host = await async_client.get("/api/parties/current", headers=host)
    assert current_host.json() is None

    rejected = await async_client.post(
        "/api/parties/join",
        json={"code": code},
        headers=guest,
    )
    assert rejected.status_code == 409
    assert rejected.json()["message"] == f"party was cancelled: {party_id}"


@pytest.mark.asyncio
async def test_party_ws_rejects_non_member(
    async_client: AsyncClient,
    party_headers,
    isolated_session_factory,
):
    host = party_headers(501, "hostws")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    party_id = uuid.UUID(create.json()["id"])

    async with isolated_session_factory() as session:
        with pytest.raises(PartyForbidden):
            await get_party_for_member(session, party_id, 502)


async def _complete_game_grid(async_client: AsyncClient, headers: dict, game_id: str) -> None:
    game = await async_client.get(f"/api/games/{game_id}", headers=headers)
    assert game.status_code == 200
    puzzle = game.json()["puzzle"]
    # Fill remaining empties from known solution via moves would need solution;
    # set via DB for speed in party results tests.
    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            result = await session.execute(select(Game).where(Game.id == uuid.UUID(game_id)))
            row = result.scalar_one()
            row.current_grid = KNOWN_SOLUTION
            await session.commit()
    finally:
        await engine.dispose()
    assert puzzle == KNOWN_PUZZLE
    complete = await async_client.post(
        f"/api/games/{game_id}/complete",
        json={"elapsed_seconds": 200},
        headers=headers,
    )
    assert complete.status_code == 200
    assert complete.json()["party_id"] is not None


@pytest.mark.asyncio
async def test_party_history_and_results(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
):
    host = party_headers(601, "host_hist")
    guest = party_headers(602, "guest_hist")
    outsider = party_headers(603, "outsider")

    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    party = create.json()
    await async_client.post("/api/parties/join", json={"code": party["code"]}, headers=guest)
    start = await async_client.post(
        f"/api/parties/{party['id']}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert start.status_code == 200
    host_game_id = start.json()["game_id"]

    history_empty_outsider = await async_client.get("/api/games/history", headers=outsider)
    assert history_empty_outsider.status_code == 200
    assert history_empty_outsider.json()["items"] == []

    history_host = await async_client.get("/api/games/history", headers=host)
    assert history_host.status_code == 200
    items = history_host.json()["items"]
    assert len(items) == 1
    assert items[0]["party_id"] == party["id"]
    assert items[0]["is_party"] is True

    results_before = await async_client.get(
        f"/api/parties/{party['id']}/results",
        headers=host,
    )
    assert results_before.status_code == 200
    assert (
        sum(player["elapsed_seconds"] is not None for player in results_before.json()["players"])
        == 0
    )

    forbidden = await async_client.get(
        f"/api/parties/{party['id']}/results",
        headers=outsider,
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["message"] == f"not a member of party: {party['id']}"

    await _complete_game_grid(async_client, host, host_game_id)

    results = await async_client.get(
        f"/api/parties/{party['id']}/results",
        headers=guest,
    )
    assert results.status_code == 200
    body = results.json()
    assert body["code"] == party["code"]
    assert body["difficulty"] == "easy"
    assert body["assists"]["pencil"] is True
    assert len(body["players"]) == 2
    assert body["players"][0]["status"] == "completed"
    assert body["players"][0]["elapsed_seconds"] == 200
    assert body["players"][0]["pencil_count"] == 0
    assert body["players"][0]["display_name"] == "host_hist"
    assert body["players"][1]["status"] == "in_progress"
    assert body["players"][1]["elapsed_seconds"] is None
    assert sum(player["elapsed_seconds"] is not None for player in body["players"]) == 1


class _NotifyBot:
    def __init__(self) -> None:
        self.messages: list[tuple[int, str]] = []
        self.delivery_allowed = asyncio.Event()
        self.delivery_allowed.set()

    async def me(self) -> SimpleNamespace:
        return SimpleNamespace(username="sudoku_bot")

    async def send_message(self, chat_id: int, text: str, **_kwargs: object) -> None:
        await self.delivery_allowed.wait()
        self.messages.append((chat_id, text))


async def _started_party_game_id(async_client: AsyncClient, host: dict, guest: dict) -> str:
    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    party = create.json()
    await async_client.post("/api/parties/join", json={"code": party["code"]}, headers=guest)
    start = await async_client.post(
        f"/api/parties/{party['id']}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert start.status_code == 200
    return start.json()["game_id"]


@pytest.mark.asyncio
async def test_party_completion_notifies_guest_only(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
) -> None:
    host = party_headers(701, "host_notify")
    guest = party_headers(702, "guest_notify")
    game_id = await _started_party_game_id(async_client, host, guest)

    bot = _NotifyBot()
    app.state.bot = bot
    try:
        await _complete_game_grid(async_client, host, game_id)
        await drain()
    finally:
        app.state.bot = None

    assert [chat_id for chat_id, _text in bot.messages] == [702]
    assert "finished the party puzzle" in bot.messages[0][1]


@pytest.mark.asyncio
async def test_completion_responds_before_the_party_notice_is_sent(
    async_client: AsyncClient,
    party_headers,
    mock_party_puzzle: None,
) -> None:
    host = party_headers(703, "host_slow_bot")
    guest = party_headers(704, "guest_slow_bot")
    game_id = await _started_party_game_id(async_client, host, guest)

    bot = _NotifyBot()
    bot.delivery_allowed.clear()
    app.state.bot = bot
    try:
        await _complete_game_grid(async_client, host, game_id)
        assert bot.messages == []
        bot.delivery_allowed.set()
        await drain()
    finally:
        app.state.bot = None

    assert [chat_id for chat_id, _text in bot.messages] == [704]


def test_build_completion_message_includes_lobby():
    text = build_completion_message(
        "guest_hist",
        125,
        "ABC123",
        datetime(2026, 7, 28, 17, 55, tzinfo=UTC),
    )
    assert "guest_hist" in text
    assert "2:05" in text
    assert "ABC123" in text
    assert "28 Jul 2026" in text


def test_build_completion_message_escapes_display_name():
    text = build_completion_message(
        "<b>@guest</b>",
        125,
        "ABC123",
        datetime(2026, 7, 28, 17, 55, tzinfo=UTC),
    )
    assert "<b>&lt;b&gt;@guest&lt;/b&gt;</b>" in text


@pytest.mark.asyncio
async def test_party_join_rejected_when_full(async_client: AsyncClient, party_headers) -> None:
    host = party_headers(801, "host_full")
    create = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": ASSISTS},
        headers=host,
    )
    assert create.status_code == 201
    party_id = create.json()["id"]
    code = create.json()["code"]

    for index in range(MAX_PARTY_SIZE - 1):
        guest = party_headers(810 + index, f"guest_full_{index}")
        join = await async_client.post(
            "/api/parties/join",
            json={"code": code},
            headers=guest,
        )
        assert join.status_code == 200
        assert len(join.json()["members"]) == index + 2

    late = party_headers(890, "guest_full_late")
    rejected = await async_client.post(
        "/api/parties/join",
        json={"code": code},
        headers=late,
    )
    assert rejected.status_code == 409
    assert rejected.json()["message"] == f"party is full: {party_id}"


@pytest.mark.asyncio
async def test_concurrent_join_during_start_does_not_leave_a_member_without_a_game(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Start holds the party row through puzzle take. Join must block until that transaction ends.
    host_id = 901
    guest_id = 902
    start_inside = asyncio.Event()
    release_start = asyncio.Event()

    async def fake_take(_session, difficulty):
        start_inside.set()
        await asyncio.wait_for(release_start.wait(), timeout=3)
        return _fake_generate(difficulty)

    monkeypatch.setattr("app.services.puzzle_pool_service.take_puzzle", fake_take)
    monkeypatch.setattr(
        "app.services.puzzle_pool_service.schedule_refill",
        lambda _difficulty: None,
    )

    async with isolated_session_factory() as session:
        host = await upsert_telegram_user(session, host_id, "race_host")
        await upsert_telegram_user(session, guest_id, "race_guest")
        created = await create_party(
            session,
            host,
            Difficulty.easy,
            GameAssistsPayload.model_validate(ASSISTS),
        )
        party_id = created.id
        code = created.code

    async def run_start() -> None:
        async with isolated_session_factory() as session:
            host_user = await session.get(User, host_id)
            if host_user is None:
                raise RuntimeError(f"host missing: {host_id}")
            await start_party(session, host_user, party_id, Difficulty.easy)

    async def run_join_attempt() -> None:
        await asyncio.wait_for(start_inside.wait(), timeout=3)
        try:
            async with isolated_session_factory() as session:
                await session.execute(text("SET lock_timeout = '500ms'"))
                guest = await session.get(User, guest_id)
                if guest is None:
                    raise RuntimeError(f"guest missing: {guest_id}")
                with pytest.raises(DBAPIError, match=r"(?i)lock timeout"):
                    await join_party(session, guest, code)
                await session.rollback()
        finally:
            release_start.set()

    await asyncio.wait_for(asyncio.gather(run_start(), run_join_attempt()), timeout=5)

    async with isolated_session_factory() as session:
        guest = await session.get(User, guest_id)
        if guest is None:
            raise RuntimeError(f"guest missing: {guest_id}")
        with pytest.raises(PartyNotWaiting):
            await join_party(session, guest, code)
        stored = await load_party(session, party_id)
        assert stored.status == PartyStatus.started
        assert stored.members
        assert all(member.game_id is not None for member in stored.members)
        assert all(member.user_id != guest_id for member in stored.members)


async def _require_user(session, user_id: int) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise RuntimeError(f"user missing: {user_id}")
    return user


async def _reject_while_start_holds_party_lock(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
    *,
    host_id: int,
    party_id: uuid.UUID,
    attempt,
) -> None:
    # Start holds the party row through puzzle take, so the attempt waits and then sees started.
    start_inside = asyncio.Event()

    async def fake_take(_session, difficulty):
        start_inside.set()
        await asyncio.sleep(0.5)
        return _fake_generate(difficulty)

    monkeypatch.setattr("app.services.puzzle_pool_service.take_puzzle", fake_take)
    monkeypatch.setattr(
        "app.services.puzzle_pool_service.schedule_refill",
        lambda _difficulty: None,
    )

    async def run_start() -> None:
        async with isolated_session_factory() as session:
            host = await _require_user(session, host_id)
            await start_party(session, host, party_id, Difficulty.easy)

    async def run_attempt() -> None:
        await asyncio.wait_for(start_inside.wait(), timeout=3)
        async with isolated_session_factory() as session:
            with pytest.raises(PartyNotWaiting):
                await attempt(session)

    await asyncio.wait_for(asyncio.gather(run_start(), run_attempt()), timeout=5)


@pytest.mark.asyncio
async def test_leave_during_start_keeps_the_member_and_their_game(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    host_id = 911
    guest_id = 912
    async with isolated_session_factory() as session:
        host = await upsert_telegram_user(session, host_id, "leave_host")
        guest = await upsert_telegram_user(session, guest_id, "leave_guest")
        created = await create_party(
            session,
            host,
            Difficulty.easy,
            GameAssistsPayload.model_validate(ASSISTS),
        )
        await join_party(session, guest, created.code)
        party_id = created.id

    async def attempt(session) -> None:
        leaving = await _require_user(session, guest_id)
        await leave_party(session, leaving, party_id)

    await _reject_while_start_holds_party_lock(
        isolated_session_factory,
        monkeypatch,
        host_id=host_id,
        party_id=party_id,
        attempt=attempt,
    )

    async with isolated_session_factory() as session:
        stored = await load_party(session, party_id)
        guest_members = [member for member in stored.members if member.user_id == guest_id]
        assert stored.status == PartyStatus.started
        assert len(guest_members) == 1
        assert guest_members[0].game_id is not None
        assert all(member.game_id is not None for member in stored.members)


@pytest.mark.asyncio
async def test_cancel_during_start_leaves_the_party_started(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    host_id = 921
    async with isolated_session_factory() as session:
        host = await upsert_telegram_user(session, host_id, "cancel_host")
        created = await create_party(
            session,
            host,
            Difficulty.easy,
            GameAssistsPayload.model_validate(ASSISTS),
        )
        party_id = created.id

    async def attempt(session) -> None:
        cancelling = await _require_user(session, host_id)
        await cancel_party(session, cancelling, party_id)

    await _reject_while_start_holds_party_lock(
        isolated_session_factory,
        monkeypatch,
        host_id=host_id,
        party_id=party_id,
        attempt=attempt,
    )

    async with isolated_session_factory() as session:
        stored = await load_party(session, party_id)
        assert stored.status == PartyStatus.started


@pytest.mark.asyncio
async def test_difficulty_change_during_start_keeps_the_started_difficulty(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    host_id = 931
    async with isolated_session_factory() as session:
        host = await upsert_telegram_user(session, host_id, "diff_host")
        created = await create_party(
            session,
            host,
            Difficulty.easy,
            GameAssistsPayload.model_validate(ASSISTS),
        )
        party_id = created.id

    async def attempt(session) -> None:
        editing = await _require_user(session, host_id)
        await update_party_difficulty(session, editing, party_id, Difficulty.hard)

    await _reject_while_start_holds_party_lock(
        isolated_session_factory,
        monkeypatch,
        host_id=host_id,
        party_id=party_id,
        attempt=attempt,
    )

    async with isolated_session_factory() as session:
        stored = await load_party(session, party_id)
        assert stored.status == PartyStatus.started
        assert stored.difficulty == Difficulty.easy


def _member(party, user_id: int):
    for member in party.members:
        if member.user_id == user_id:
            return member
    raise AssertionError(f"member missing: {user_id}")


def _assists() -> GameAssistsPayload:
    return GameAssistsPayload.model_validate(ASSISTS)


@pytest.mark.asyncio
async def test_started_party_member_can_join_another_lobby(
    isolated_session_factory,
    mock_party_puzzle: None,
) -> None:
    host_id = 941
    guest_id = 942
    other_host_id = 943
    async with isolated_session_factory() as session:
        host = await upsert_telegram_user(session, host_id, "keep_host")
        guest = await upsert_telegram_user(session, guest_id, "keep_guest")
        other_host = await upsert_telegram_user(session, other_host_id, "keep_other")
        first = await create_party(session, host, Difficulty.easy, _assists())
        await join_party(session, guest, first.code)
        await start_party(session, host, first.id, Difficulty.easy)
        first_party_id = first.id
        first_game_id = _member(await load_party(session, first.id), guest_id).game_id
        second = await create_party(session, other_host, Difficulty.easy, _assists())
        second_party_id = second.id
        second_code = second.code

    assert first_game_id is not None

    async with isolated_session_factory() as session:
        guest = await _require_user(session, guest_id)
        joined = await join_party(session, guest, second_code)
        assert joined.id == second_party_id
        assert _member(joined, guest_id).game_id is None
        started = await load_party(session, first_party_id)
        assert _member(started, guest_id).game_id == first_game_id
        started_game = await session.get(Game, first_game_id)
        assert started_game is not None
        assert started_game.status == GameStatus.in_progress

    async with isolated_session_factory() as session:
        other_host = await _require_user(session, other_host_id)
        await start_party(session, other_host, second_party_id, Difficulty.easy)

    async with isolated_session_factory() as session:
        started_game = await session.get(Game, first_game_id)
        assert started_game is not None
        assert started_game.status == GameStatus.abandoned
        started = await load_party(session, first_party_id)
        assert _member(started, guest_id).game_id == first_game_id


_LOCK_WAIT_COUNT = text(
    "SELECT count(*) FROM pg_stat_activity "
    "WHERE wait_event_type = 'Lock' "
    "AND datname = current_database() "
    "AND pid <> pg_backend_pid()",
)


@pytest.mark.asyncio
async def test_join_during_start_keeps_the_guest_and_joins_the_other_lobby(
    isolated_session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    host_id = 951
    guest_id = 952
    other_host_id = 953
    async with isolated_session_factory() as session:
        host = await upsert_telegram_user(session, host_id, "overlap_host")
        guest = await upsert_telegram_user(session, guest_id, "overlap_guest")
        other_host = await upsert_telegram_user(session, other_host_id, "overlap_other")
        first = await create_party(session, host, Difficulty.easy, _assists())
        await join_party(session, guest, first.code)
        second = await create_party(session, other_host, Difficulty.easy, _assists())
        first_party_id = first.id
        second_party_id = second.id
        second_code = second.code

    start_holds_party = asyncio.Event()
    release_start = asyncio.Event()

    async def pause_after_party_lock(_session, difficulty: Difficulty):
        start_holds_party.set()
        await release_start.wait()
        return _fake_generate(difficulty)

    monkeypatch.setattr("app.services.puzzle_pool_service.take_puzzle", pause_after_party_lock)
    monkeypatch.setattr(
        "app.services.puzzle_pool_service.schedule_refill",
        lambda _difficulty: None,
    )

    async def run_start() -> None:
        async with isolated_session_factory() as session:
            starting_host = await _require_user(session, host_id)
            await start_party(session, starting_host, first_party_id, Difficulty.easy)

    async def run_join() -> None:
        async with isolated_session_factory() as session:
            joining_guest = await _require_user(session, guest_id)
            joined = await join_party(session, joining_guest, second_code)
            assert joined.id == second_party_id

    start_task = asyncio.create_task(run_start())
    join_task: asyncio.Task[None] | None = None
    saw_lock_wait = False
    try:
        await asyncio.wait_for(start_holds_party.wait(), timeout=5)
        join_task = asyncio.create_task(run_join())
        async with isolated_session_factory() as watch:
            for _ in range(200):
                waiting = await watch.scalar(_LOCK_WAIT_COUNT)
                if waiting:
                    saw_lock_wait = True
                    break
                await asyncio.sleep(0.01)
            else:
                raise AssertionError("join did not wait for the party row lock")
        release_start.set()
        await asyncio.wait_for(asyncio.gather(start_task, join_task), timeout=5)
    finally:
        release_start.set()
        for task in (start_task, join_task):
            if task is not None and not task.done():
                task.cancel()
        pending = [task for task in (start_task, join_task) if task is not None]
        await asyncio.gather(*pending, return_exceptions=True)

    assert saw_lock_wait, "join did not wait for the party row lock"

    async with isolated_session_factory() as session:
        started = await load_party(session, first_party_id)
        guest_member = _member(started, guest_id)
        assert guest_member.game_id is not None
        started_game = await session.get(Game, guest_member.game_id)
        assert started_game is not None
        assert started_game.status == GameStatus.in_progress
        waiting_party = await load_party(session, second_party_id)
        assert waiting_party.status == PartyStatus.waiting
        assert _member(waiting_party, guest_id).game_id is None


def test_party_ws_event_json_matches_the_dict_events() -> None:
    party_id = uuid.UUID("11111111-1111-4111-8111-111111111111")
    guest_game_id = uuid.UUID("22222222-2222-4222-8222-222222222222")
    started_game_id = uuid.UUID("33333333-3333-4333-8333-333333333333")
    party = Party(
        id=party_id,
        code="ABCDEF",
        host_user_id=11,
        difficulty=Difficulty.medium,
        assists=dict(ASSISTS),
        status=PartyStatus.waiting,
        created_at=datetime(2026, 11, 4, 9, 0, tzinfo=UTC),
    )
    party.members = [
        PartyMember(
            party_id=party_id,
            user_id=22,
            display_name="Guest",
            joined_at=datetime(2026, 11, 4, 10, 1, tzinfo=UTC),
            game_id=guest_game_id,
        ),
        PartyMember(
            party_id=party_id,
            user_id=11,
            display_name="Host",
            joined_at=datetime(2026, 11, 4, 10, 0, tzinfo=UTC),
            game_id=None,
        ),
    ]
    members = party_to_response(party, party.host_user_id)
    assert json.loads(party_members_event(party).model_dump_json()) == {
        "type": "members",
        "party_id": str(party.id),
        "status": party.status.value,
        "difficulty": party.difficulty.value,
        "members": [member.model_dump(mode="json") for member in members.members],
    }
    assert json.loads(party_started_event(party, started_game_id).model_dump_json()) == {
        "type": "started",
        "party_id": str(party.id),
        "game_id": str(started_game_id),
        "difficulty": party.difficulty.value,
        "assists": party.assists,
    }
    assert json.loads(party_cancelled_event(party).model_dump_json()) == {
        "type": "cancelled",
        "party_id": str(party.id),
    }
