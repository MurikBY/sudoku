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

echo "previous $(git rev-parse --short HEAD)"
git pull
docker compose up -d --build

for service in postgres backend frontend; do
  wait_until_healthy "$service"
done

docker compose ps
