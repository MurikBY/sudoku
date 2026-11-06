# Decisions

Each section is one choice: what the code does, why, and what it costs. How a puzzle is rated and generated is in [ENGINE.md](ENGINE.md). Trust boundaries are in [SECURITY.md](SECURITY.md).

## Pre-generated puzzles

**Decision.** Starting a game or a party takes a row from `puzzle_pool` and deletes it. A lesson and an analysis do not. One worker process refills each difficulty to `PUZZLE_POOL_TARGET_SIZE` (50). The loop wakes every `PUZZLE_POOL_REFILL_INTERVAL_SECONDS` (30), and a take schedules the same refill. The process is started with `spawn`, one worker, `nice` 10. The API process does not generate. An empty difficulty answers HTTP 503: "No puzzles ready for this difficulty. Try again in a couple of minutes."

**Why.** Generating on request makes the player wait. On the serving host, medium generation takes about 0.9 s and hard generation about 1 s. The benchmark is in [ENGINE.md](ENGINE.md). The pool returns a stored row.

Refill is a process, not `asyncio.to_thread`. A thread shares the GIL with the event loop, so generation there stalls the API.

**Trade-off.** The pool can be empty, and the player waits for the next successful refill. A failed generation is not run inside the API process. `refill_one` tries three times and then raises. `ensure_stock` logs that and stops the difficulty for the current pass. One worker refills the difficulties one after another.

## Party lobby

**Decision.** While a lobby is waiting, the client holds a WebSocket and also polls `fetchCurrentParty` every 1500 ms.

**Why.** The socket is `/api/ws/parties/{id}`. The client first asks for a ticket. `consume` removes it, so it works once, and it expires after 30 seconds. The socket pushes `members`, `started`, and `cancelled`. Start sends each player their own game id. `onclose` clears the socket reference and does not open another.

The poll is the recovery. A dropped socket still learns that the party started, or that a guest's current party is gone, on the next poll.

**Trade-off.** The poll keeps running while the socket is open. A missed push waits up to 1500 ms. There is no reconnect.

## Move log

**Decision.** `games.events` is a JSONB list on the game row. `current_grid` is the live 81-character board. `notes` and `undo_stack` are separate JSONB columns. `replay_available` is true when `events` is non-empty.

**Why.** Replay and analysis rebuild a position with `replay_events_to_state`, walking a prefix of the log from the puzzle. The grid is only the present. Writers append `set`, `clear`, and `notes`. Undo pops `undo_stack`. When the digit changes, undo appends a new `set` or `clear`, so the log still reaches the restored grid. Restored pencil marks are written to `notes` from the stack entry.

**Trade-off.** Each append rewrites the JSONB value. A long game is one wide row, and replay walks the list in the API process. A pencil-mark undo is not itself an event. A replay that walks `events` follows the log. The live `notes` column is what the board shows after that undo.

## One device at a time

**Decision.** One play-lock token per user, on the user row, with a 30-second TTL. The client stores it in `localStorage` under `sudoku_play_lock_token` and heartbeats every 4 seconds. Each heartbeat sets the expiry to now plus 30 seconds. Acquiring a different token while one is still inside the TTL fails with "Another device is playing on this account." While the play screen or a live lobby is open, a conflict on the heartbeat, on the 8-second poll, or on becoming visible leaves that screen.

**Why.** A second client should not start play on the same account. `require_play_lock_allows` runs when a game, an analysis, or a lesson is created, and when a party is created, joined, or started. If a lock is active and the token does not match, those calls fail. If no lock is active, they proceed. The home screen disables those actions and says to leave the game on the other device, or wait about 30 seconds.

**Trade-off.** Cell writes, notes, undo, hints, complete, and abandon do not check the token. A second device that already has a game open can still change that board. A client that closes without releasing the lock holds the account until the TTL.

## One process

**Decision.** One API process. The repository has no Redis client.

**Why.** Rows live in Postgres: games, the puzzle pool, the rating archive, and the play-lock columns. A pool take uses `FOR UPDATE SKIP LOCKED`. Everything else is memory in this process:

- `party_ws_hub` holds the open party sockets.
- `party_ws_tickets` holds unused tickets.
- `bot/broadcast.py` holds broadcast drafts: `_awaiting_message_expires`, `_awaiting_confirm`, and `_album_collectors`.
- `puzzle_generator` owns the child worker.
- `pool_take_limit` holds the recent pool-take times.
- The refill loop is an asyncio task on this process.

**Trade-off.** A second API process would not see the sockets, the tickets, the drafts, or the take counters. Two refill loops would both generate. Pool takes would still be safe, because the row lock is in Postgres.

## Deleted rows and the rating archive

**Decision.** Migrations `010`, `011`, `012`, and `014` delete rows, and each `downgrade()` is empty. The deleted games are not personal records and not leaderboard times. Their totals stay in `rating_counter_archive`.

**Why.** `010` deleted every `puzzle_pool` row: those puzzles had been accepted under the previous rater and older givens floors. `012` deleted pooled medium puzzles after the medium band changed. `014` deleted pooled hard puzzles after an XYZ-Wing elimination started requiring the victim to see the pivot as well as both wings. `011` deleted `party_members`, `games`, and `parties`: those games and party results had been rated under the old rules.

Migration `018` creates `rating_counter_archive` and seeds one row per difficulty: `games_started`, `games_completed`, `clean_wins`, and `clean_elapsed_sum`. Later resets add to those rows.

`build_user_stats` reads live `games` only. The Rating summary adds the archive to live scored games (`is_analysis` and `is_lesson` are false), so started games, completed games, clean wins, and the average clean time include it. The average is the combined `clean_elapsed_sum` divided by the combined clean-win count. Best clean wins ranks live `CLEAN_WIN` rows only: completed, no mistakes, no hints, and not an analysis or a lesson. `reset_user_play_data` folds that player's current scored games into the same archive, then deletes the rows. A reset follows the same split.

**Trade-off.** Downgrade cannot restore the games or the old best times. The rating average mixes the archived totals with games played under the current rules. My Stats does not show the archive.

## One technique iterator

**Decision.** The coach and the rating solver share the iterators in `technique_steps.py`. `TECHNIQUES` registers each iterator once.

**Why.** The coach and the rating must use the same technique. One iterator is that technique, so a change cannot update the hint and leave the grade behind. How the scan runs is in [ENGINE.md](ENGINE.md).

**Trade-off.** Editing an iterator changes the grade and the next coach step together.

## Recorded time

**Decision.** The server stores `elapsed_seconds` only when the reported value is at most the age of the game plus 5 seconds. A smaller report does not replace a larger stored value.

**Why.** The client sends the clock. `credit_play_time` rejects a value past `started_at` plus `ELAPSED_TOLERANCE_SECONDS` (5). The bound stops a time the game cannot have lasted. It does not prove the player was fast. A clean win means no mistakes and no hints as the server recorded them. The rest of that boundary is in [SECURITY.md](SECURITY.md).

**Trade-off.** Any client can report a time up to the age of the game. Waiting, or solving off the recorded path, is inside the bound.

## What would change at 100,000 users

`games` is indexed on `user_id`, `party_id`, `share_code`, `is_analysis`, and `is_lesson`. There is no index on `difficulty` or `status`.

A player's own stats filter by `user_id`. The rating page does not. `rating_summaries_by_difficulty` counts and sums every scored game, grouped by difficulty, on each read, then adds the archive. The clean-best list groups every clean win of a difficulty by user (`min(elapsed_seconds)`) and then keeps 10 rows. The rank counts every user with a better time, so that grouped set is read even though the page shows 10.

`events` grows on the game row. Each append rewrites the JSONB value. A long game is a wide row, and replay walks the list in the API process.

A second process does not make those reads cheaper. It breaks the in-memory pieces listed under "One process".
