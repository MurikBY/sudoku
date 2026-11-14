# Security

What the server checks, what a client can still do, and what is not built. The choices behind the pool, the lobby, and recorded time are in [DECISIONS.md](DECISIONS.md).

## Authentication

Every API route except health, readiness, the OpenAPI document, and the Telegram webhook requires the `X-Init-Data` header. A missing header is HTTP 401, `X-Init-Data header is missing`.

FastAPI reads a JSON body before the route's dependencies run, so the body is read before the header is checked. `RequestBodyLimit` caps it at 1 MiB, by `Content-Length` or by the bytes received, and answers HTTP 413 above that. An unreadable body is HTTP 400.

`parse_and_validate` checks the Telegram Mini App signature. The secret is HMAC-SHA256 of the bot token under the key `WebAppData`. The signed string is the other fields, sorted, joined with newlines. The comparison uses `hmac.compare_digest`. A bad signature, a missing `hash`, a missing or non-integer `auth_date`, or a missing user id is HTTP 401 with the validator's message.

`auth_date` older than 86400 seconds is rejected. A timestamp more than 60 seconds in the future is rejected. That 60 seconds is clock skew, not a longer lifetime. A captured header stays valid until it expires or the bot token changes.

The handler then inserts or updates the user and passes that row to the route. A game read by id is limited to that user. A share code is not: see below.

## WebSocket

The party socket is `/api/ws/parties/{party_id}?ticket=`. The ticket is not `initData`. The client asks for it with an authenticated `POST`, and the store keeps it in this process.

`consume` removes the ticket, so it works once. It expires after 30 seconds, and it must name the same party. A missing, expired, or mismatched ticket, or a user who is not a member, is accepted and then closed with code 4401. The socket does not reconnect.

The client sends nothing on the socket. uvicorn runs with `--ws-max-size 1024`, so a larger frame closes the socket with code 1009 before the application reads it.

## Webhook and admin commands

Telegram posts updates to `POST /api/telegram/webhook`. The header is `X-Telegram-Bot-Api-Secret-Token`. A missing header and a wrong value both get HTTP 403, `Invalid webhook secret`, compared with `hmac.compare_digest`. If the secret is unset, or the bot is not running, the route answers HTTP 503 and does not feed the update.

Startup refuses a configuration where the bot is enabled, polling is off, and the secret is missing. A secret that is set must match `^[A-Za-z0-9_-]{1,256}$`.

`/total`, `/broadcast`, `/send`, and `/cancel` run only when the sender's id is in `ADMIN_TELEGRAM_IDS`. Anyone else gets no reply. An empty list means there is no admin. `/start` and a pasted invite code are for every user.

## Configuration

`Settings` loads at import. An invalid environment refuses to start. Extra variables are ignored.

- `DATABASE_URL` is required.
- `BOT_TOKEN` has at least 10 characters and matches `^[0-9]+:[A-Za-z0-9_-]+$`.
- `DOMAIN` is a bare host, with no scheme and no slash.
- `WEBAPP_URL` equals `https://` plus `DOMAIN`, ignoring one trailing slash, and it is listed in `ALLOWED_ORIGINS`.
- `LOG_LEVEL` is `DEBUG`, `INFO`, `WARNING`, or `ERROR`.
- `ADMIN_TELEGRAM_IDS` is a comma-separated list of integers, or empty.
- When refill is enabled, `PUZZLE_POOL_TARGET_SIZE` is at least 1 and `PUZZLE_POOL_REFILL_INTERVAL_SECONDS` is positive.

CORS allows the origins in `ALLOWED_ORIGINS`, every method, and every header.

## Rating

A move writes the digit the client sent. `is_move_mistake` compares it with the stored solution, and a mistake increments `mistakes_count`. `mistake_feedback` and `auto_clear_notes` on a move come from `games.assists`, not from the request body. `mistakes_count` does not depend on `mistake_feedback`. A write that repeats the digit already in the cell is not a new move. It still credits elapsed time. Undo restores the cell and does not decrement `mistakes_count`. A hint increments `hints_count`.

`complete_game` stores a win only when `current_grid` equals the stored solution and the grid is complete. `credit_play_time` stores `elapsed_seconds` only when it is at most the age of the game plus 5 seconds, and a smaller report does not replace a larger stored value. The request schema also rejects a value above 7 days.

A clean win is a completed scored game with `mistakes_count` 0 and `hints_count` 0. Scored games are not analysis and not lessons. The server can reject a time the game cannot have lasted, and it can count the mistakes and hints it saw. It cannot prove the player was fast, or that the player solved alone.

## What the client can already see

This is accepted. Hiding fields would not change the rating, and closing the live review would remove product behavior. The live board response does not include `solution`. The review response does, including a game still in progress.

`GameResponse`, which is the live board, includes `puzzle` and `wrong_digit_indices`. It does not include `solution`. A generated puzzle is stored only when `count_solutions` is 1, so the puzzle on the client is enough to compute the answer locally. `wrong_digit_indices` is the entered digits that differ from the stored solution, and `MoveCellResponse.is_mistake` says the same for the last write. Both are sent whether or not the highlight is on.

The assist `mistakeFeedback` hides the highlight and the mistake animation. Dimmed digits, the completed-unit flash, and auto-complete still read `wrong_digit_indices`. Auto-complete calls `complete_game` when the grid is full, `conflict_indices` is empty, and `wrong_digit_indices` is empty. Emptying that list in the response would make a full wrong grid look finished.

`GET /api/games/by-code/{code}` requires a valid session. For any regular game it returns `solution`, including a live game of the owner or of another player. Analysis and lesson games are not found by this lookup. `GET /api/games/{id}/review` returns the same payload for the owner's own regular game. `play_from_here_available` is false only when the viewer is the owner and the game is still `in_progress`. Another player can open that live game and start from a move. Export to chat uses the same code lookup and sends the document to the caller's Telegram chat.

A party start copies one puzzle and one solution onto every member. Party results are members-only. Each player who has a game row is listed with `share_code`, including a game still `in_progress`. That code is the review above, so a member can open another member's board and its solution. The progress list does not include the code. It includes how many cells are filled.

Hiding `solution` on a live review would leave `puzzle` and `wrong_digit_indices` on the board response. Rejecting another player's live review would remove "Play from current move" and the chat export.

## Two hosts joining each other

`join_party` locks the destination and every waiting party that user would leave, in ascending party id order, then re-reads status. If two hosts join each other's parties at the same moment, the joins serialize. One waits. The first join commits: that host's lobby is cancelled, and they become a member of the other lobby. The waiting join then sees a party that is no longer waiting, raises `party was cancelled`, and rolls back. Postgres does not abort either transaction.

## Addresses, CSP, and dependency checks

The principal is the Telegram user in `initData`. A request with no live signature is already a 401. Taking a puzzle from the pool is limited per Telegram user, 6 takes in 60 seconds across new games and party starts, and the next one answers 429. The counter lives in this process. A reset followed by a clean win can push the same player out of the Top 10 again, so the "pushed out" message goes to one player at most once per difficulty in 24 hours. That cooldown also lives in this process. Other routes have no rate limit, and a per-IP rule is not used because many WebView clients share an address. That includes joining by code. A lobby code is 6 characters from a 32-character alphabet, about 1.07 billion codes. A right guess only adds the guesser to a lobby that is still waiting and has a free seat, and the host sees every member before the start.

There is no Content-Security-Policy. The client is a Vite bundle inside the Telegram WebView. A strict policy has to be proven against that WebView, and a policy that allows inline scripts does not constrain the page. Static responses do send `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000`, and `Permissions-Policy`, which turns off the camera, microphone, geolocation, payment, and USB. The client uses the clipboard and vibration, so those stay allowed. Traefik sends `/api` to FastAPI, so those headers are not on the API.

`/api/health`, `/api/ready`, `/api/docs`, and `/api/openapi.json` do not require a session. Readiness runs `SELECT 1`. The OpenAPI document describes the routes. It does not contain secrets.

Dependabot opens weekly update requests for the backend `uv` lock, the frontend npm lock, GitHub Actions, the backend and frontend Docker images, and the PostgreSQL image in the compose file. Every base image is pinned by exact version and digest, and every GitHub Action by commit SHA, so a rebuild or a CI run uses the same code until one of those requests changes it. Minor and patch updates are grouped. The Python and Node runtimes move by hand, so Dependabot ignores their new versions, and it ignores the TypeScript, `@vitejs/plugin-react`, and `@types/node` majors. Each ignore names its reason in `.github/dependabot.yml`. CI runs the tests and builds the images. It does not run `npm audit` or a Python audit: those checks fail the build on transitive advisories, and the same updates already arrive as Dependabot requests.

## Reporting

Questions and reports go to [t.me/Murik_BY](https://t.me/Murik_BY).
