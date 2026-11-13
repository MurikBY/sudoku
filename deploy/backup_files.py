import re
from datetime import UTC, datetime
from pathlib import Path

# The names backup-db.sh writes; the UTC stamp sorts in time order.
_DUMP_NAME = re.compile(r"^sudoku-(\d{8}T\d{6}Z)\.dump$")
STAMP_FORMAT = "%Y%m%dT%H%M%SZ"


def dumps(backup_dir: Path) -> list[tuple[datetime, Path]]:
    found: list[tuple[datetime, Path]] = []
    for path in backup_dir.iterdir():
        match = _DUMP_NAME.match(path.name)
        if match is not None and path.is_file():
            stamp = datetime.strptime(match.group(1), STAMP_FORMAT).replace(tzinfo=UTC)
            found.append((stamp, path))
    return sorted(found)


def env_copy(backup_dir: Path, stamp: datetime) -> Path:
    return backup_dir / f"env-{stamp.strftime(STAMP_FORMAT)}"
