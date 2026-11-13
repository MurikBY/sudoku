import sys
from collections.abc import Callable, Hashable
from datetime import UTC, datetime, timedelta
from pathlib import Path

from backup_files import dumps, env_copy

# Backups come from the daily cron and from every deploy. Recent ones are all kept,
# because a bad migration is found within days; older ones thin out to one a week,
# then one a month. Pruning runs only after a new dump, so a stopped cron deletes nothing.
KEEP_EVERY_DUMP_DAYS = 7
KEEP_WEEKS = 4
KEEP_MONTHS = 6


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


def prune(backup_dir: Path, now: datetime) -> tuple[list[str], int]:
    found = dumps(backup_dir)
    keep = stamps_to_keep([stamp for stamp, _path in found], now)
    removed: list[str] = []
    for stamp, dump in found:
        if stamp in keep:
            continue
        dump.unlink()
        removed.append(dump.name)
        # Dumps written before backup-db.sh stopped copying .env still have one.
        copy = env_copy(backup_dir, stamp)
        if copy.is_file():
            copy.unlink()
            removed.append(copy.name)
    kept = sum(1 for stamp, _path in found if stamp in keep)
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
