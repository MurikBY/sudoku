# AGENTS.md

Telegram Mini App: Sudoku with a technique-based puzzle generator, coach hints, lessons, and party play.

## Stack and layout

| Part | Stack | Path |
|---|---|---|
| Backend | FastAPI, SQLAlchemy 2 async, asyncpg, Alembic, aiogram 3, uv | `backend/` (`app/`, `alembic/`, `tests/`, `scripts/`) |
| Frontend | React 19, Vite, TypeScript, Tailwind 4 | `frontend/` |
| Database | PostgreSQL 16 | `docker-compose.yml` |
| Infra | Docker Compose | `docker-compose*.yml`, `deploy/` |

Backend layers: `api/` (routers, HTTP only) → `services/` (business logic) → `models/` (SQLAlchemy). Domain errors derive from the categories in `services/errors.py` and become responses only in `api/errors.py`; routers do not catch them. Game logic lives in `services/games/`. Player stats and the clean-best rating live in `services/stats/`, and party lobby, start, and responses live in `services/party/`. `schemas/` are request/response models, `schemas/mappers.py` turns ORM objects into responses. The sudoku engine lives in `services/sudoku/`. The pool refill generates puzzles in a worker process (`services/puzzle_generator.py`, `services/sudoku/generation_worker.py`), never on the event loop or in a thread. Technique iterators live in `services/sudoku/technique_steps.py`: the coach explains the first step, and the rating solver applies the scan. Frontend navigation is the `ScreenState` reducer in `hooks/screenState.ts`, and `App.tsx` renders on `screen.name`. Board edits share the queue in `hooks/useGame.ts`.

## Rules for this repository

- Write short, single-purpose functions; extract reusable logic into helpers. Split files by responsibility: state apart from rendering, one feature per file.
- No silent fallbacks when reading data. Missing or invalid values raise.
- Config comes from environment variables and is validated at startup in `app/config.py`. Secrets live in `.env` only; `.env.example` is committed.
- Every schema change is an Alembic migration. Never edit an applied migration.
- Tests create their own database engine; never use the process-global engine in tests.
- Backend checks: `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run python scripts/export_openapi.py --check && uv run pytest`. Tests read `DATABASE_URL` from the shell, not from `.env`; it must name a `*_test` database, otherwise pytest refuses to start (exit code 2). Frontend checks: `cd frontend && npm run gen:api && git diff --exit-code src/api/schema.d.ts && npm run lint && npm run typecheck && npm test && npm run build`. CI runs both, and also builds the backend and frontend Docker images.
- Verify with linters, tests, and throwaway scripts; do not start the application.
- Telegram Mini App rules: HTTP auth is the `X-Init-Data` header, verified with HMAC and `compare_digest`, rejected when `auth_date` is older than 24 hours or more than 60 seconds in the future. WebSocket auth uses a one-time ticket, never `initData` in the URL. `index.html` and `version.json` are served with `no-store`; hashed assets are `immutable`; a `buildId` mismatch reloads once. Layout reads the `--safe-*` tokens, which prefer Telegram's `--tg-safe-area-inset-*` and fall back to `env(safe-area-inset-*)`; full-height screens use `--app-vh`, taken from `viewportStableHeight`.
- Deployment is scripted: commit, push, then run `deploy/deploy.sh` on the host. The host never holds hand-edited code. Never remove volumes there (`docker compose down -v`).
- Commits: one logical change per commit; subject is one imperative English sentence stating the outcome; no type prefixes.

## Docs

| File | Answers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Where the code lives and how a request moves |
| [`docs/ENGINE.md`](docs/ENGINE.md) | How puzzles are rated and generated |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why the main choices were made |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Trust boundaries and known limits |
| [`docs/LEARN.md`](docs/LEARN.md) | How Learn works |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Palette, type, and the gazette components |
