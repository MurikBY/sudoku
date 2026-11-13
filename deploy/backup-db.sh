#!/usr/bin/env bash
set -euo pipefail

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

: "${POSTGRES_USER:?POSTGRES_USER missing in .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD missing in .env}"
: "${POSTGRES_DB:?POSTGRES_DB missing in .env}"

COMPOSE_CMD=${COMPOSE_CMD:-docker compose}
BACKUP_DIR=${BACKUP_DIR:-"$ROOT/backups"}
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_PATH="$BACKUP_DIR/sudoku-${STAMP}.dump"
ENV_COPY_PATH="$BACKUP_DIR/env-${STAMP}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "dumping to $DUMP_PATH"
$COMPOSE_CMD exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  >"$DUMP_PATH"

cp .env "$ENV_COPY_PATH"
chmod 600 "$DUMP_PATH" "$ENV_COPY_PATH"

echo "wrote $DUMP_PATH"
echo "wrote $ENV_COPY_PATH"

# Runs only after the new dump is on disk, so a failed dump never costs an old one.
python3 "$ROOT/deploy/prune_backups.py" "$BACKUP_DIR"
