#!/bin/sh
set -e
alembic upgrade head
# websockets-sansio: "auto" would pick uvicorn's protocol on the deprecated websockets.legacy API.
# The client sends nothing on the party socket, so a frame above 1 KiB is closed unread.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --ws websockets-sansio --ws-max-size 1024
