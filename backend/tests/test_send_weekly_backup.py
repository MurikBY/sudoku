import os
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tests.deploy_scripts import load_deploy_script

_WEEKLY = load_deploy_script("send_weekly_backup")
_TELEGRAM = load_deploy_script("telegram_bot")
NOW = datetime(2026, 11, 16, 4, 0, tzinfo=UTC)


def _write_dump(backup_dir: Path, moment: datetime, content: bytes) -> Path:
    path = backup_dir / f"sudoku-{moment:%Y%m%dT%H%M%SZ}.dump"
    path.write_bytes(content)
    return path


def _decrypt(encrypted: bytes, workdir: Path) -> bytes:
    source = workdir / "copy.enc"
    target = workdir / "copy.dump"
    source.write_bytes(encrypted)
    subprocess.run(
        [
            "openssl",
            "enc",
            "-d",
            *_WEEKLY.CIPHER_ARGS,
            "-in",
            str(source),
            "-out",
            str(target),
            "-pass",
            "env:BACKUP_PASSPHRASE",
        ],
        check=True,
    )
    return target.read_bytes()


def test_the_newest_dump_is_sent_encrypted(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BACKUP_PASSPHRASE", "test passphrase")
    backups = tmp_path / "backups"
    backups.mkdir()
    _write_dump(backups, NOW - timedelta(days=1), b"older dump")
    newest = os.urandom(4096)
    _write_dump(backups, NOW - timedelta(minutes=30), newest)
    sent: list[tuple[str, bytes, str]] = []

    name = _WEEKLY.send_newest_dump(
        backups,
        lambda path, caption: sent.append((path.name, path.read_bytes(), caption)),
    )

    assert name == f"sudoku-{NOW - timedelta(minutes=30):%Y%m%dT%H%M%SZ}.dump.enc"
    [(sent_name, encrypted, caption)] = sent
    assert sent_name == name
    assert encrypted != newest
    assert _decrypt(encrypted, tmp_path) == newest
    assert "2026-11-16 03:30 UTC" in caption
    assert _WEEKLY.DECRYPT_COMMAND in caption


def test_a_folder_without_dumps_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        _WEEKLY.send_newest_dump(tmp_path, lambda _path, _caption: None)


def test_a_copy_over_the_upload_limit_is_not_sent(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BACKUP_PASSPHRASE", "test passphrase")
    monkeypatch.setattr(_WEEKLY, "TELEGRAM_UPLOAD_LIMIT_BYTES", 10)
    _write_dump(tmp_path, NOW, os.urandom(100))
    sent: list[str] = []

    with pytest.raises(ValueError, match="over the Bot API limit"):
        _WEEKLY.send_newest_dump(tmp_path, lambda path, _caption: sent.append(path.name))

    assert sent == []


def test_an_empty_passphrase_is_refused(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BACKUP_PASSPHRASE", "")
    monkeypatch.setenv("BACKUP_TELEGRAM_CHAT_ID", "1")
    monkeypatch.setenv("BOT_TOKEN", "123:abc")

    with pytest.raises(ValueError, match="BACKUP_PASSPHRASE is empty"):
        _WEEKLY.main(["send_weekly_backup.py", str(tmp_path)])


def test_the_upload_carries_the_fields_and_the_file(tmp_path: Path) -> None:
    upload = tmp_path / "copy.enc"
    upload.write_bytes(b"\x00encrypted\xff")

    body, content_type = _TELEGRAM.multipart_body(
        {"chat_id": "42", "caption": "hi"}, "document", upload
    )

    boundary = content_type.removeprefix("multipart/form-data; boundary=")
    assert body.startswith(f"--{boundary}\r\n".encode())
    assert body.endswith(f"--{boundary}--\r\n".encode())
    assert b'name="chat_id"\r\n\r\n42\r\n' in body
    assert b'name="document"; filename="copy.enc"' in body
    assert b"\x00encrypted\xff" in body
