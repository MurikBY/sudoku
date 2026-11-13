from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tests.deploy_scripts import load_deploy_script

_FRESHNESS = load_deploy_script("check_backup_freshness")
NOW = datetime(2026, 11, 14, 5, 0, tzinfo=UTC)


def _write_dump(backup_dir: Path, moment: datetime) -> None:
    (backup_dir / f"sudoku-{moment:%Y%m%dT%H%M%SZ}.dump").write_bytes(b"dump")


def test_a_dump_from_this_morning_is_fresh() -> None:
    assert _FRESHNESS.stale_backup_message(NOW - timedelta(hours=1, minutes=30), NOW) is None


def test_a_missed_night_is_reported_with_its_age() -> None:
    message = _FRESHNESS.stale_backup_message(NOW - timedelta(hours=49), NOW)

    assert message is not None
    assert "49 hours old" in message


def test_no_dump_at_all_is_reported() -> None:
    assert _FRESHNESS.stale_backup_message(None, NOW) == (
        "Sudoku has no database backup on the server."
    )


def test_every_admin_gets_the_alert_for_a_stale_folder(tmp_path: Path) -> None:
    _write_dump(tmp_path, NOW - timedelta(days=3))
    _write_dump(tmp_path, NOW - timedelta(days=2))
    sent: list[tuple[int, str]] = []

    message = _FRESHNESS.alert_if_stale(
        tmp_path, NOW, [11, 22], lambda chat_id, text: sent.append((chat_id, text))
    )

    assert message is not None
    assert "48 hours old" in message
    assert [chat_id for chat_id, _text in sent] == [11, 22]


def test_a_fresh_folder_sends_nothing(tmp_path: Path) -> None:
    _write_dump(tmp_path, NOW - timedelta(hours=2))
    sent: list[tuple[int, str]] = []

    message = _FRESHNESS.alert_if_stale(
        tmp_path, NOW, [11], lambda chat_id, text: sent.append((chat_id, text))
    )

    assert message is None
    assert sent == []


def test_admin_ids_must_name_someone() -> None:
    assert _FRESHNESS.admin_chat_ids("11, 22") == [11, 22]
    with pytest.raises(ValueError, match="nobody would get the alert"):
        _FRESHNESS.admin_chat_ids("")
