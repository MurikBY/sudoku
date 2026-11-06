#!/usr/bin/env python3
import argparse
import hashlib
import hmac
import json
import os
import time
from urllib.parse import urlencode


def sign_init_data(
    bot_token: str,
    user_id: int,
    username: str,
    auth_date: int | None,
) -> str:
    params = _init_data_params(user_id, username, auth_date)
    params["hash"] = _init_data_hash(bot_token, params)
    return urlencode(params)


def _init_data_params(user_id: int, username: str, auth_date: int | None) -> dict[str, str]:
    user_json = json.dumps({"id": user_id, "username": username, "first_name": "Test"})
    params = {"user": user_json}
    if auth_date is not None:
        params["auth_date"] = str(auth_date)
    return params


def _init_data_hash(bot_token: str, params: dict[str, str]) -> str:
    check_string = "\n".join(f"{key}={value}" for key, value in sorted(params.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    return hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()


def main() -> int:
    args = _parse_args()
    print(sign_init_data(_require_bot_token(), args.user_id, args.username, int(time.time())))
    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print a signed Telegram initData string for local development",
    )
    parser.add_argument("--user-id", type=int, default=1001)
    parser.add_argument("--username", default="dev_player")
    return parser.parse_args()


def _require_bot_token() -> str:
    bot_token = os.environ.get("BOT_TOKEN")
    if bot_token is None or bot_token == "":
        raise SystemExit("BOT_TOKEN is required")
    return bot_token


if __name__ == "__main__":
    raise SystemExit(main())
