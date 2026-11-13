#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

wait_until_healthy() {
  local service="$1"
  local deadline=$((SECONDS + 120))
  local health_status="missing"
  local container_id=""
  local inspected=""

  while (( SECONDS < deadline )); do
    container_id="$(docker compose ps -q "$service")"
    container_id="${container_id%%$'\n'*}"
    health_status="missing"
    if [[ -n "$container_id" ]]; then
      if inspected="$(docker inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null)"; then
        health_status="$inspected"
      fi
    fi
    if [[ "$health_status" == "healthy" ]]; then
      return 0
    fi
    if [[ "$health_status" == "unhealthy" ]]; then
      break
    fi
    if (( SECONDS + 2 >= deadline )); then
      break
    fi
    sleep 2
  done

  echo "${service} health is ${health_status}" >&2
  docker compose logs --tail 80 "$service" || true
  exit 1
}

backup_running_database() {
  # A first deploy has no database to back up yet.
  if [[ -z "$(docker compose ps -q postgres)" ]]; then
    echo "postgres is not running; skipping the backup"
    return 0
  fi
  ./deploy/backup-db.sh
}

echo "previous $(git rev-parse --short HEAD)"
# The host never holds its own commits, so anything but a fast-forward is a mistake to stop on.
git pull --ff-only
# Build while the old containers still serve, then back up right before
# the new backend starts and runs its migrations.
docker compose build
backup_running_database
docker compose up -d

for service in postgres backend frontend; do
  wait_until_healthy "$service"
done

docker compose ps
