import pytest

from app.models.enums import Difficulty
from app.services import puzzle_pool_service


class _FakeSessionCM:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, *_args):
        return False


def _patch_pool_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(puzzle_pool_service.settings, "PUZZLE_POOL_TARGET_SIZE", 50)
    monkeypatch.setattr("app.db.session_factory", lambda: _FakeSessionCM())


@pytest.mark.asyncio
async def test_ensure_stock_skips_when_at_target(
    monkeypatch: pytest.MonkeyPatch,
):
    _patch_pool_settings(monkeypatch)

    generate_calls = 0

    async def fake_count(_session, _difficulty):
        return 50

    async def fake_refill(_difficulty):
        nonlocal generate_calls
        generate_calls += 1

    monkeypatch.setattr(puzzle_pool_service, "count_pooled", fake_count)
    monkeypatch.setattr(puzzle_pool_service, "refill_one", fake_refill)

    await puzzle_pool_service.ensure_stock(Difficulty.medium)
    assert generate_calls == 0


@pytest.mark.asyncio
async def test_ensure_stock_generates_shortfall_of_two(
    monkeypatch: pytest.MonkeyPatch,
):
    _patch_pool_settings(monkeypatch)

    available = 48
    generate_calls = 0

    async def fake_count(_session, _difficulty):
        return available

    async def fake_refill(_difficulty):
        nonlocal available, generate_calls
        available += 1
        generate_calls += 1

    monkeypatch.setattr(puzzle_pool_service, "count_pooled", fake_count)
    monkeypatch.setattr(puzzle_pool_service, "refill_one", fake_refill)

    await puzzle_pool_service.ensure_stock(Difficulty.easy)
    assert generate_calls == 2
    assert available == 50


@pytest.mark.asyncio
async def test_ensure_stock_fills_to_target_at_any_hour(
    monkeypatch: pytest.MonkeyPatch,
):
    _patch_pool_settings(monkeypatch)

    available = 11
    generate_calls = 0

    async def fake_count(_session, _difficulty):
        return available

    async def fake_refill(_difficulty):
        nonlocal available, generate_calls
        available += 1
        generate_calls += 1

    monkeypatch.setattr(puzzle_pool_service, "count_pooled", fake_count)
    monkeypatch.setattr(puzzle_pool_service, "refill_one", fake_refill)

    await puzzle_pool_service.ensure_stock(Difficulty.hard)
    assert generate_calls == 39
    assert available == 50
