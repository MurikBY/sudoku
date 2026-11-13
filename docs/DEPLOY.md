# Deploy

How the production host is updated, backed up, and restored. The host keeps a git checkout in `/opt/sudoku` and never holds hand-edited code.

## Deploying

Commit and push, wait for CI, then run on the host:

```bash
cd /opt/sudoku && ./deploy/deploy.sh
```

`deploy.sh` pulls fast-forward only, builds the images while the old containers still serve, takes a database backup, and starts the new containers. The backend runs `alembic upgrade head` before uvicorn, so the backup comes right before the migrations. The script waits until postgres, backend, and frontend report healthy.

bash reads a script while it runs. When a commit changes `deploy.sh` itself, run `git pull --ff-only` first, then `deploy.sh`.

## Backups

| When (UTC) | Script | What it does |
|---|---|---|
| every deploy | `backup-db.sh` | `pg_dump` to `backups/sudoku-<stamp>.dump` before the migrations |
| daily 03:30 | `backup-db.sh` | the same dump |
| daily 05:00 | `check-backup-freshness.sh` | the bot messages `ADMIN_TELEGRAM_IDS` when the newest dump is older than 26 hours |
| Monday 04:00 | `send-weekly-backup.sh` | the bot sends the newest dump, AES-256 encrypted, to `BACKUP_TELEGRAM_CHAT_ID` |

Root's crontab on the host:

```
30 3 * * * /opt/sudoku/deploy/backup-db.sh >> /opt/sudoku/backups/cron.log 2>&1
0 4 * * 1 /opt/sudoku/deploy/send-weekly-backup.sh >> /opt/sudoku/backups/cron.log 2>&1
0 5 * * * /opt/sudoku/deploy/check-backup-freshness.sh >> /opt/sudoku/backups/cron.log 2>&1
```

After each dump, `prune_backups.py` keeps every dump of the last 7 days, then the newest dump of each of the last 4 weeks and of each of the last 6 months. It runs only after a new dump succeeds, so a stopped cron deletes nothing. `.env` is not copied next to the dumps.

The weekly copy is the only one off the server. Its passphrase is `BACKUP_PASSPHRASE` in `.env`; keep a copy in a password manager, because the copy cannot be opened without it.

## Restoring

`restore-db.sh` stops the backend, replaces the data in `POSTGRES_DB`, and starts the backend again. It is destructive.

From a dump on the host:

```bash
cd /opt/sudoku && ./deploy/restore-db.sh backups/sudoku-<stamp>.dump
```

From the weekly copy in Telegram, decrypt it first, then copy the dump to the host and restore it the same way:

```bash
BACKUP_PASSPHRASE='<passphrase>' openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in sudoku-<stamp>.dump.enc -out sudoku-<stamp>.dump
```
