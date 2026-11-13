#!/usr/bin/env bash
set -euo pipefail

# Weekly from root's crontab: the bot sends the newest dump, encrypted, to the owner's chat.
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
: "${BACKUP_TELEGRAM_CHAT_ID:?BACKUP_TELEGRAM_CHAT_ID missing in .env}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE missing in .env}"

BACKUP_DIR=${BACKUP_DIR:-"$ROOT/backups"}
python3 "$ROOT/deploy/send_weekly_backup.py" "$BACKUP_DIR"
