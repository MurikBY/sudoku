import os
import subprocess
import sys
import tempfile
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from backup_files import dumps
from telegram_bot import send_document

# The Bot API takes uploads up to 50 MB from a bot.
TELEGRAM_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024
CIPHER_ARGS = ["-aes-256-cbc", "-pbkdf2", "-iter", "600000"]
DECRYPT_COMMAND = "openssl enc -d " + " ".join(CIPHER_ARGS) + " -in <file>.enc -out sudoku.dump"

SendDocument = Callable[[Path, str], None]


def newest_dump(backup_dir: Path) -> tuple[datetime, Path]:
    found = dumps(backup_dir)
    if not found:
        raise FileNotFoundError(f"no dump in {backup_dir}")
    return found[-1]


def encrypt(dump: Path, target: Path) -> None:
    # openssl reads BACKUP_PASSPHRASE itself, so the passphrase never appears in a command line.
    subprocess.run(
        [
            "openssl",
            "enc",
            *CIPHER_ARGS,
            "-salt",
            "-in",
            str(dump),
            "-out",
            str(target),
            "-pass",
            "env:BACKUP_PASSPHRASE",
        ],
        check=True,
    )


def caption_for(stamp: datetime, size_bytes: int) -> str:
    return (
        f"Sudoku database backup, {stamp:%Y-%m-%d %H:%M} UTC, "
        f"{size_bytes / 1024 / 1024:.1f} MB, encrypted.\nDecrypt: {DECRYPT_COMMAND}"
    )


def send_newest_dump(backup_dir: Path, send: SendDocument) -> str:
    stamp, dump = newest_dump(backup_dir)
    with tempfile.TemporaryDirectory() as workdir:
        encrypted = Path(workdir) / f"{dump.name}.enc"
        encrypt(dump, encrypted)
        size_bytes = encrypted.stat().st_size
        if size_bytes > TELEGRAM_UPLOAD_LIMIT_BYTES:
            raise ValueError(f"{encrypted.name} is {size_bytes} bytes, over the Bot API limit")
        send(encrypted, caption_for(stamp, size_bytes))
        return encrypted.name


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {argv[0]} <backup-dir>", file=sys.stderr)
        return 2
    if not os.environ["BACKUP_PASSPHRASE"]:
        raise ValueError("BACKUP_PASSPHRASE is empty")
    chat_id = int(os.environ["BACKUP_TELEGRAM_CHAT_ID"])
    bot_token = os.environ["BOT_TOKEN"]
    sent = send_newest_dump(
        Path(argv[1]),
        lambda path, caption: send_document(bot_token, chat_id, path, caption),
    )
    print(f"sent {sent} to chat {chat_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
