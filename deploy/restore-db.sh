#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <path-to.dump>" >&2
  echo "WARNING: replaces data in POSTGRES_DB (destructive)." >&2
  exit 1
fi

DUMP_PATH="$1"
if [[ ! -f "$DUMP_PATH" ]]; then
  echo "dump not found: $DUMP_PATH" >&2
  exit 1
fi

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

echo "WARNING: restoring into database '$POSTGRES_DB' (destructive)."
echo "Stopping backend…"
$COMPOSE_CMD stop backend

echo "Restoring $DUMP_PATH…"
$COMPOSE_CMD exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner \
  <"$DUMP_PATH"

echo "Starting backend…"
$COMPOSE_CMD start backend

echo "restore complete"
