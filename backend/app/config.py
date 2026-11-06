import re
from typing import Annotated, Literal, Self

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_BOT_TOKEN_PATTERN = r"^[0-9]+:[A-Za-z0-9_-]+$"
_WEBHOOK_SECRET_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,256}$")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    BOT_TOKEN: str = Field(min_length=10, pattern=_BOT_TOKEN_PATTERN)
    ALLOWED_ORIGINS: list[str]
    DOMAIN: str
    WEBAPP_URL: str
    TELEGRAM_USE_POLLING: bool = False
    TELEGRAM_BOT_ENABLED: bool = True
    ADMIN_TELEGRAM_IDS: Annotated[list[int], NoDecode] = []
    TELEGRAM_WEBHOOK_SECRET: str | None = None
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    PUZZLE_POOL_TARGET_SIZE: int = 50
    PUZZLE_POOL_REFILL_INTERVAL_SECONDS: float = 30.0
    PUZZLE_POOL_REFILL_ENABLED: bool = True

    @field_validator("ADMIN_TELEGRAM_IDS", mode="before")
    @classmethod
    def parse_admin_telegram_ids(cls, value: object) -> list[int]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return [int(item) for item in value]
        if isinstance(value, str):
            return [int(part.strip()) for part in value.split(",") if part.strip()]
        raise ValueError("ADMIN_TELEGRAM_IDS must be a comma-separated list of integers")

    @field_validator("TELEGRAM_WEBHOOK_SECRET", mode="before")
    @classmethod
    def parse_webhook_secret(cls, value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("TELEGRAM_WEBHOOK_SECRET must be a string")
        stripped = value.strip()
        if stripped == "":
            return None
        return stripped

    @model_validator(mode="after")
    def validate_constraints(self) -> Self:
        _require_webhook_secret(self)
        _require_webapp_on_domain(self)
        if self.PUZZLE_POOL_REFILL_ENABLED:
            _require_puzzle_pool_bounds(self)
        return self


def _require_webhook_secret(settings: Settings) -> None:
    secret = settings.TELEGRAM_WEBHOOK_SECRET
    bot_uses_webhook = settings.TELEGRAM_BOT_ENABLED and not settings.TELEGRAM_USE_POLLING
    if bot_uses_webhook and secret is None:
        raise ValueError(
            "TELEGRAM_WEBHOOK_SECRET is required when TELEGRAM_BOT_ENABLED is true "
            "and TELEGRAM_USE_POLLING is false",
        )
    if secret is not None and _WEBHOOK_SECRET_PATTERN.fullmatch(secret) is None:
        raise ValueError("TELEGRAM_WEBHOOK_SECRET must match ^[A-Za-z0-9_-]{1,256}$")


def _require_webapp_on_domain(settings: Settings) -> None:
    _require_bare_domain(settings.DOMAIN)
    expected_webapp_url = f"https://{settings.DOMAIN}"
    if _without_one_trailing_slash(settings.WEBAPP_URL) != expected_webapp_url:
        raise ValueError("WEBAPP_URL must equal https://DOMAIN, ignoring one trailing slash")
    if settings.WEBAPP_URL not in settings.ALLOWED_ORIGINS:
        raise ValueError("WEBAPP_URL must be listed in ALLOWED_ORIGINS")


def _require_bare_domain(domain: str) -> None:
    has_scheme_or_slash = "://" in domain or "/" in domain
    has_whitespace = any(character.isspace() for character in domain)
    if domain == "" or has_scheme_or_slash or has_whitespace:
        raise ValueError("DOMAIN must be a bare host name, without a scheme or slash")


def _without_one_trailing_slash(url: str) -> str:
    if url.endswith("/"):
        return url[:-1]
    return url


def _require_puzzle_pool_bounds(settings: Settings) -> None:
    if settings.PUZZLE_POOL_TARGET_SIZE < 1:
        raise ValueError("PUZZLE_POOL_TARGET_SIZE must be at least 1")
    if settings.PUZZLE_POOL_REFILL_INTERVAL_SECONDS <= 0:
        raise ValueError("PUZZLE_POOL_REFILL_INTERVAL_SECONDS must be positive")


settings = Settings()
