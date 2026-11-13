import importlib.util
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType

import pytest


def _load_prune_backups() -> ModuleType:
    path = Path(__file__).resolve().parents[2] / "deploy" / "prune_backups.py"
    spec = importlib.util.spec_from_file_location("prune_backups", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_PRUNE = _load_prune_backups()
NOW = datetime(2026, 11, 13, 20, 0, tzinfo=UTC)


def _stamp(moment: datetime) -> str:
    return moment.strftime("%Y%m%dT%H%M%SZ")


def _write_backup(backup_dir: Path, moment: datetime) -> None:
    (backup_dir / f"sudoku-{_stamp(moment)}.dump").write_bytes(b"dump")
    (backup_dir / f"env-{_stamp(moment)}").write_text("env")


def test_recent_dumps_are_all_kept() -> None:
    recent = [NOW - timedelta(hours=hours) for hours in (1, 2, 30, 6 * 24)]

    assert _PRUNE.stamps_to_keep(recent, NOW) == set(recent)


def test_older_dumps_thin_out_to_weeks_then_months() -> None:
    daily = [NOW - timedelta(days=days) for days in range(0, 400)]

    keep = _PRUNE.stamps_to_keep(daily, NOW)

    older = sorted(stamp for stamp in keep if NOW - stamp > timedelta(days=7))
    months = {(stamp.year, stamp.month) for stamp in older}
    assert len(keep) <= 7 + 1 + _PRUNE.KEEP_WEEKS + _PRUNE.KEEP_MONTHS
    assert len(months) >= _PRUNE.KEEP_MONTHS - 1
    assert min(older) > NOW - timedelta(days=31 * _PRUNE.KEEP_MONTHS)


def test_newest_dump_is_kept_even_when_it_is_old() -> None:
    old = [NOW - timedelta(days=days) for days in (400, 500)]

    assert max(old) in _PRUNE.stamps_to_keep(old, NOW)


def test_prune_removes_a_dump_with_its_env_copy_and_nothing_else(tmp_path: Path) -> None:
    for days in range(0, 120):
        _write_backup(tmp_path, NOW - timedelta(days=days))
    (tmp_path / "sudoku-manual-copy.dump").write_bytes(b"manual")
    (tmp_path / "cron.log").write_text("log")

    removed, kept = _PRUNE.prune(tmp_path, NOW)

    dumps = sorted(path.name for path in tmp_path.glob("sudoku-2*.dump"))
    envs = sorted(path.name for path in tmp_path.glob("env-*"))
    assert kept == len(dumps)
    assert [name.removeprefix("sudoku-").removesuffix(".dump") for name in dumps] == [
        name.removeprefix("env-") for name in envs
    ]
    assert len(removed) == 2 * (120 - kept)
    assert (tmp_path / "sudoku-manual-copy.dump").exists()
    assert (tmp_path / "cron.log").exists()
    assert f"sudoku-{_stamp(NOW)}.dump" in dumps


@pytest.mark.parametrize("argv", [["prune_backups.py"], ["prune_backups.py", "a", "b"]])
def test_main_requires_one_directory(argv: list[str]) -> None:
    assert _PRUNE.main(argv) == 2


def test_main_rejects_a_missing_directory(tmp_path: Path) -> None:
    assert _PRUNE.main(["prune_backups.py", str(tmp_path / "missing")]) == 1
