import pytest
from httpx import AsyncClient, Response

from app.services.pool_take_limit import PoolTakeLimit
from tests.fixtures import PARTY_ASSISTS

_RATE_LIMITED = {
    "code": "pool_take_rate_limited",
    "message": "Too many new games in a minute. Try again shortly.",
}


class _Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def _use_clock(monkeypatch: pytest.MonkeyPatch, clock: _Clock) -> None:
    monkeypatch.setattr(
        "app.services.pool_take_limit.pool_take_limit",
        PoolTakeLimit(clock),
    )


async def _post_game(async_client: AsyncClient, headers: dict[str, str]) -> Response:
    return await async_client.post(
        "/api/games",
        json={"difficulty": "easy"},
        headers=headers,
    )


async def _take_games(
    async_client: AsyncClient,
    headers: dict[str, str],
    count: int,
) -> None:
    for _ in range(count):
        created = await _post_game(async_client, headers)
        assert created.status_code == 201, created.text


@pytest.mark.asyncio
async def test_seventh_take_is_limited_to_that_player(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
) -> None:
    player = init_data_for(user_id=1301, username="limited")
    other = init_data_for(user_id=1302, username="other")

    await _take_games(async_client, player, 6)

    rejected = await _post_game(async_client, player)
    assert rejected.status_code == 429
    assert rejected.json() == _RATE_LIMITED

    allowed = await _post_game(async_client, other)
    assert allowed.status_code == 201


@pytest.mark.asyncio
async def test_take_is_allowed_again_after_the_window(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clock = _Clock()
    _use_clock(monkeypatch, clock)
    player = init_data_for(user_id=1303, username="window")

    await _take_games(async_client, player, 6)
    rejected = await _post_game(async_client, player)
    assert rejected.status_code == 429

    clock.now += 60
    allowed = await _post_game(async_client, player)
    assert allowed.status_code == 201


@pytest.mark.asyncio
async def test_party_start_counts_against_the_host(
    async_client: AsyncClient,
    init_data_for,
    mock_puzzle_generation: None,
) -> None:
    host = init_data_for(user_id=1304, username="host_limit")
    await _take_games(async_client, host, 5)

    created = await async_client.post(
        "/api/parties",
        json={"difficulty": "easy", "assists": PARTY_ASSISTS},
        headers=host,
    )
    assert created.status_code == 201

    started = await async_client.post(
        f"/api/parties/{created.json()['id']}/start",
        json={"difficulty": "easy"},
        headers=host,
    )
    assert started.status_code == 200

    rejected = await _post_game(async_client, host)
    assert rejected.status_code == 429
    assert rejected.json() == _RATE_LIMITED
