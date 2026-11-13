#!/usr/bin/env bash
set -euo pipefail

# Keeps the newest BACKUP_KEEP dumps, each with the .env copy taken at the same moment.
# Count, not age: backups run on deploy, so a quiet month must not leave a single copy.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR=${BACKUP_DIR:-"$ROOT/backups"}
BACKUP_KEEP=${BACKUP_KEEP:-10}

if [[ ! "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_KEEP must be a positive integer, got: $BACKUP_KEEP" >&2
  exit 1
fi
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "missing backup directory: $BACKUP_DIR" >&2
  exit 1
fi

# Only names backup-db.sh writes; the UTC stamp sorts in time order.
shopt -s nullglob
dumps=()
for path in "$BACKUP_DIR"/sudoku-*.dump; do
  name="${path##*/}"
  if [[ "$name" =~ ^sudoku-[0-9]{8}T[0-9]{6}Z\.dump$ ]]; then
    dumps+=("$name")
  fi
done

excess=$((${#dumps[@]} - BACKUP_KEEP))
if ((excess <= 0)); then
  echo "keeping ${#dumps[@]} backup(s), limit $BACKUP_KEEP"
  exit 0
fi

for name in "${dumps[@]:0:excess}"; do
  stamp="${name#sudoku-}"
  stamp="${stamp%.dump}"
  rm -- "$BACKUP_DIR/$name"
  echo "pruned $name"
  if [[ -f "$BACKUP_DIR/env-$stamp" ]]; then
    rm -- "$BACKUP_DIR/env-$stamp"
    echo "pruned env-$stamp"
  fi
done
echo "keeping $BACKUP_KEEP backup(s)"
