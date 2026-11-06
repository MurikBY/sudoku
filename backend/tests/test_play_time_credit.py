from datetime import UTC, datetime
from types import SimpleNamespace

from app.services.games.lifecycle import credit_play_time


def test_credit_play_time_applies_deltas_and_ignores_stale() -> None:
    game = SimpleNamespace(elapsed_seconds=0, started_at=datetime.now(UTC))

    credit_play_time(game, 90)
    assert game.elapsed_seconds == 90

    credit_play_time(game, 90)
    assert game.elapsed_seconds == 90

    credit_play_time(game, 100)
    assert game.elapsed_seconds == 100

    credit_play_time(game, 80)
    assert game.elapsed_seconds == 100


def test_credit_play_time_updates_analysis_and_lesson_games() -> None:
    analysis = SimpleNamespace(
        elapsed_seconds=0,
        started_at=datetime.now(UTC),
        is_analysis=True,
        is_lesson=False,
    )
    credit_play_time(analysis, 40)
    assert analysis.elapsed_seconds == 40

    lesson = SimpleNamespace(
        elapsed_seconds=0,
        started_at=datetime.now(UTC),
        is_analysis=False,
        is_lesson=True,
    )
    credit_play_time(lesson, 25)
    assert lesson.elapsed_seconds == 25
