import json
import os
import sys
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

from backup_files import dumps

# The daily backup runs at 03:30 UTC; a day plus two hours leaves room for a slow dump.
MAX_BACKUP_AGE = timedelta(hours=26)
TELEGRAM_TIMEOUT_SECONDS = 20

Send = Callable[[int, str], None]


def stale_backup_message(newest: datetime | None, now: datetime) -> str | None:
    if newest is None:
        return "Sudoku has no database backup on the server."
    age = now - newest
    if age <= MAX_BACKUP_AGE:
        return None
    hours = int(age.total_seconds() // 3600)
    return (
        f"The newest sudoku database backup is {hours} hours old "
        f"({newest:%Y-%m-%d %H:%M} UTC). Check the backup cron on the server."
    )


def admin_chat_ids(raw: str) -> list[int]:
    chat_ids = [int(part) for part in raw.split(",") if part.strip()]
    if not chat_ids:
        raise ValueError("ADMIN_TELEGRAM_IDS is empty, so nobody would get the alert")
    return chat_ids


def alert_if_stale(backup_dir: Path, now: datetime, chat_ids: list[int], send: Send) -> str | None:
    found = dumps(backup_dir)
    message = stale_backup_message(found[-1][0] if found else None, now)
    if message is not None:
        for chat_id in chat_ids:
            send(chat_id, message)
    return message


def telegram_sender(bot_token: str) -> Send:
    def send(chat_id: int, text: str) -> None:
        request = urllib.request.Request(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            data=json.dumps({"chat_id": chat_id, "text": text}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=TELEGRAM_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise RuntimeError(f"Telegram answered HTTP {response.status}")

    return send


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {argv[0]} <backup-dir>", file=sys.stderr)
        return 2
    backup_dir = Path(argv[1])
    if not backup_dir.is_dir():
        print(f"missing backup directory: {backup_dir}", file=sys.stderr)
        return 1
    chat_ids = admin_chat_ids(os.environ["ADMIN_TELEGRAM_IDS"])
    message = alert_if_stale(
        backup_dir,
        datetime.now(UTC),
        chat_ids,
        telegram_sender(os.environ["BOT_TOKEN"]),
    )
    if message is None:
        print("newest backup is fresh")
        return 0
    print(f"alerted {len(chat_ids)} admin(s): {message}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
