#!/usr/bin/env bash
set -euo pipefail

# Daily from root's crontab, after the backup: messages the admins when the newest dump is old.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "missing .env in $ROOT" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${BOT_TOKEN:?BOT_TOKEN missing in .env}"
: "${ADMIN_TELEGRAM_IDS:?ADMIN_TELEGRAM_IDS missing in .env}"

BACKUP_DIR=${BACKUP_DIR:-"$ROOT/backups"}
python3 "$ROOT/deploy/check_backup_freshness.py" "$BACKUP_DIR"
