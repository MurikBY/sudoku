from urllib.parse import parse_qsl, urlencode

import pytest

from app.config import settings
from app.services import auth
from app.services.auth import (
    AUTH_DATE_MAX_AGE_SECONDS,
    AUTH_DATE_MAX_FUTURE_SECONDS,
    extract_user,
    parse_and_validate,
)
from tests.fixtures import make_init_data


@pytest.fixture(autouse=True)
def bot_token(monkeypatch):
    token = "123456:ABC-DEF"
    monkeypatch.setenv("BOT_TOKEN", token)
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")
    monkeypatch.setenv("DOMAIN", "sudoku.murik.dev")
    monkeypatch.setenv("WEBAPP_URL", "https://sudoku.murik.dev")
    monkeypatch.setenv("ALLOWED_ORIGINS", '["https://sudoku.murik.dev"]')
    monkeypatch.setattr(settings, "BOT_TOKEN", token)
    auth._secret_key.cache_clear()
    return token


def test_parse_and_validate_accepts_valid_init_data(bot_token):
    init_data = make_init_data(bot_token)
    params = parse_and_validate(init_data)
    user_id, username = extract_user(params)
    assert user_id == 42
    assert username == "tester"


def test_parse_and_validate_rejects_tampered_hash(bot_token):
    init_data = make_init_data(bot_token) + "tampered"
    with pytest.raises(ValueError, match="invalid"):
        parse_and_validate(init_data)


@pytest.mark.parametrize("received_hash", ["я", "я" * 64])
def test_parse_and_validate_rejects_non_ascii_hash(bot_token, received_hash):
    params = dict(parse_qsl(make_init_data(bot_token), keep_blank_values=True))
    params["hash"] = received_hash
    with pytest.raises(ValueError, match="initData signature invalid"):
        parse_and_validate(urlencode(params))


def test_parse_and_validate_rejects_missing_auth_date(bot_token):
    with pytest.raises(ValueError, match="auth_date missing"):
        parse_and_validate(make_init_data(bot_token, omit_auth_date=True))


def test_parse_and_validate_rejects_expired_auth_date(bot_token, monkeypatch):
    issued_at = 1_700_000_000
    monkeypatch.setattr(
        "app.services.auth.time.time",
        lambda: issued_at + AUTH_DATE_MAX_AGE_SECONDS + 1,
    )
    init_data = make_init_data(bot_token, auth_date=issued_at)
    with pytest.raises(ValueError, match="expired"):
        parse_and_validate(init_data)


def test_parse_and_validate_accepts_auth_date_at_max_age(bot_token, monkeypatch):
    issued_at = 1_700_000_000
    monkeypatch.setattr(
        "app.services.auth.time.time",
        lambda: issued_at + AUTH_DATE_MAX_AGE_SECONDS,
    )
    parse_and_validate(make_init_data(bot_token, auth_date=issued_at))


def test_parse_and_validate_rejects_auth_date_in_the_future(bot_token, monkeypatch):
    issued_at = 1_700_000_000
    monkeypatch.setattr(
        "app.services.auth.time.time",
        lambda: issued_at - AUTH_DATE_MAX_FUTURE_SECONDS - 1,
    )
    with pytest.raises(ValueError, match="in the future"):
        parse_and_validate(make_init_data(bot_token, auth_date=issued_at))


def test_parse_and_validate_accepts_auth_date_within_clock_drift(bot_token, monkeypatch):
    issued_at = 1_700_000_000
    monkeypatch.setattr(
        "app.services.auth.time.time",
        lambda: issued_at - AUTH_DATE_MAX_FUTURE_SECONDS,
    )
    parse_and_validate(make_init_data(bot_token, auth_date=issued_at))


@pytest.mark.parametrize(
    "user_json",
    ["[]", "{}", '{"id": "42"}', '{"id": true}', '{"id": 42, "username": 7}'],
)
def test_extract_user_rejects_malformed_user(user_json):
    with pytest.raises(ValueError):
        extract_user({"user": user_json})
