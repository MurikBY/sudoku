import functools
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from app.config import settings

# A captured initData stays signed until the bot token changes. Telegram's own limit is one day.
AUTH_DATE_MAX_AGE_SECONDS = 86_400
# Allowance for clock drift between Telegram and this server.
AUTH_DATE_MAX_FUTURE_SECONDS = 60


@functools.cache
def _secret_key() -> bytes:
    return hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()


def _compute_hash(data_check_string: str) -> str:
    return hmac.new(_secret_key(), data_check_string.encode(), hashlib.sha256).hexdigest()


def parse_and_validate(init_data: str) -> dict[str, str]:
    params = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if received_hash is None:
        raise ValueError("hash missing from initData")
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    if not hmac.compare_digest(
        _compute_hash(check_string).encode("utf-8"),
        received_hash.encode("utf-8"),
    ):
        raise ValueError("initData signature invalid")
    _require_fresh_auth_date(params)
    return params


def _require_fresh_auth_date(params: dict[str, str]) -> None:
    raw_auth_date = params.get("auth_date")
    if raw_auth_date is None or raw_auth_date == "":
        raise ValueError("auth_date missing from initData")
    try:
        auth_date = int(raw_auth_date)
    except ValueError as error:
        raise ValueError("auth_date is not an integer") from error
    age_seconds = int(time.time()) - auth_date
    if age_seconds > AUTH_DATE_MAX_AGE_SECONDS:
        raise ValueError("initData expired")
    if age_seconds < -AUTH_DATE_MAX_FUTURE_SECONDS:
        raise ValueError("initData auth_date is in the future")


def extract_user(params: dict[str, str]) -> tuple[int, str | None]:
    if "user" not in params:
        raise ValueError("user field missing from initData")
    data = json.loads(params["user"])
    if not isinstance(data, dict):
        raise ValueError("user field is not an object")
    user_id = data.get("id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        raise ValueError("user id is missing or not an integer")
    username = data.get("username")
    if username is not None and not isinstance(username, str):
        raise ValueError("username is not a string")
    return user_id, username
