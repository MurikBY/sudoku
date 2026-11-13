import re
import sys
from collections.abc import Callable, Hashable
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Backups come from the daily cron and from every deploy. Recent ones are all kept,
# because a bad migration is found within days; older ones thin out to one a week,
# then one a month. Pruning runs only after a new dump, so a stopped cron deletes nothing.
KEEP_EVERY_DUMP_DAYS = 7
KEEP_WEEKS = 4
KEEP_MONTHS = 6

_DUMP_NAME = re.compile(r"^sudoku-(\d{8}T\d{6}Z)\.dump$")
_STAMP_FORMAT = "%Y%m%dT%H%M%SZ"


def _newest_per_group(
    stamps: list[datetime],
    group_of: Callable[[datetime], Hashable],
    groups: int,
) -> set[datetime]:
    newest: dict[Hashable, datetime] = {}
    for stamp in stamps:
        key = group_of(stamp)
        if key not in newest or stamp > newest[key]:
            newest[key] = stamp
    recent_groups = sorted(newest.values(), reverse=True)[:groups]
    return set(recent_groups)


def stamps_to_keep(stamps: list[datetime], now: datetime) -> set[datetime]:
    if not stamps:
        return set()
    keep = {stamp for stamp in stamps if now - stamp <= timedelta(days=KEEP_EVERY_DUMP_DAYS)}
    keep |= _newest_per_group(stamps, lambda stamp: stamp.isocalendar()[:2], KEEP_WEEKS)
    keep |= _newest_per_group(stamps, lambda stamp: (stamp.year, stamp.month), KEEP_MONTHS)
    keep.add(max(stamps))
    return keep


def _dumps(backup_dir: Path) -> list[tuple[datetime, Path]]:
    dumps: list[tuple[datetime, Path]] = []
    for path in backup_dir.iterdir():
        match = _DUMP_NAME.match(path.name)
        if match is not None and path.is_file():
            stamp = datetime.strptime(match.group(1), _STAMP_FORMAT).replace(tzinfo=UTC)
            dumps.append((stamp, path))
    return sorted(dumps)


def prune(backup_dir: Path, now: datetime) -> tuple[list[str], int]:
    dumps = _dumps(backup_dir)
    keep = stamps_to_keep([stamp for stamp, _path in dumps], now)
    removed: list[str] = []
    for stamp, dump in dumps:
        if stamp in keep:
            continue
        env_copy = backup_dir / f"env-{stamp.strftime(_STAMP_FORMAT)}"
        dump.unlink()
        removed.append(dump.name)
        if env_copy.is_file():
            env_copy.unlink()
            removed.append(env_copy.name)
    kept = sum(1 for stamp, _path in dumps if stamp in keep)
    return removed, kept


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {argv[0]} <backup-dir>", file=sys.stderr)
        return 2
    backup_dir = Path(argv[1])
    if not backup_dir.is_dir():
        print(f"missing backup directory: {backup_dir}", file=sys.stderr)
        return 1
    removed, kept = prune(backup_dir, datetime.now(UTC))
    for name in removed:
        print(f"pruned {name}")
    print(f"keeping {kept} backup(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
