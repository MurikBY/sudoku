import pytest
from pydantic import ValidationError

from app.config import Settings


def _valid_settings() -> dict[str, object]:
    return {
        "DATABASE_URL": "postgresql+asyncpg://sudoku:secret@localhost/sudoku",
        "BOT_TOKEN": "123456:ABC-DEF",
        "ALLOWED_ORIGINS": ["https://sudoku.murik.dev"],
        "DOMAIN": "sudoku.murik.dev",
        "WEBAPP_URL": "https://sudoku.murik.dev",
        "TELEGRAM_USE_POLLING": False,
        "TELEGRAM_BOT_ENABLED": True,
        "TELEGRAM_WEBHOOK_SECRET": "test_webhook_secret",
        "PUZZLE_POOL_REFILL_ENABLED": True,
        "PUZZLE_POOL_TARGET_SIZE": 50,
        "PUZZLE_POOL_REFILL_INTERVAL_SECONDS": 30,
    }


def _settings(**overrides: object) -> Settings:
    values = _valid_settings()
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_accepts_valid_settings() -> None:
    settings = _settings()
    assert settings.BOT_TOKEN == "123456:ABC-DEF"


def test_accepts_one_trailing_slash_on_webapp_url() -> None:
    settings = _settings(
        WEBAPP_URL="https://sudoku.murik.dev/",
        ALLOWED_ORIGINS=["https://sudoku.murik.dev/"],
    )
    assert settings.WEBAPP_URL == "https://sudoku.murik.dev/"


def test_empty_bot_token_is_rejected() -> None:
    with pytest.raises(ValidationError, match="BOT_TOKEN"):
        _settings(BOT_TOKEN="")


def test_malformed_bot_token_is_rejected() -> None:
    with pytest.raises(ValidationError, match="BOT_TOKEN"):
        _settings(BOT_TOKEN="not-a-token")


def test_missing_webhook_secret_with_polling_off_is_rejected() -> None:
    with pytest.raises(ValidationError, match="TELEGRAM_WEBHOOK_SECRET is required"):
        _settings(TELEGRAM_WEBHOOK_SECRET=None)


def test_webapp_url_must_match_domain() -> None:
    with pytest.raises(ValidationError, match="WEBAPP_URL must equal https://DOMAIN"):
        _settings(WEBAPP_URL="https://other.example")


def test_bot_disabled_without_secret() -> None:
    settings = _settings(TELEGRAM_BOT_ENABLED=False, TELEGRAM_WEBHOOK_SECRET=None)
    assert settings.TELEGRAM_WEBHOOK_SECRET is None
