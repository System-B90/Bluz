# Backup and restore

Bluz has two stateful engines, both defined in `deploy/docker-compose.yml`:

| Engine | Container | Volume | Holds |
| --- | --- | --- | --- |
| PostgreSQL 15 | `bluz-curriculum-db` | `pgdata` | Gantt / curriculum data |
| MongoDB 8 | `bluz-mongodb` | `mongodb_data` | Calendar, sessions, settings |

Both are dumped by one script, on one schedule, to one destination tree.

## Quick Start

```bash
# One-off backup to the default destination (/var/backups/bluz)
sudo ./deploy/backup/bluz-backup.sh

# One-off backup somewhere else
sudo BLUZ_BACKUP_DIR=/mnt/backups/bluz ./deploy/backup/bluz-backup.sh

# Install the nightly schedule (02:30 UTC)
sudo cp deploy/backup/bluz-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bluz-backup.timer
systemctl list-timers bluz-backup.timer

# Restore the newest daily dump
sudo ./deploy/backup/bluz-restore.sh "$(ls -d /var/backups/bluz/daily/* | tail -1)"
```

## What a dump contains

```
/var/backups/bluz/
├── daily/2026-08-02T02-30-00Z/
│   ├── postgres.dump          # pg_dump -Fc (compressed, selective restore)
│   ├── mongodb.archive.gz     # mongodump --archive --gzip
│   └── SHA256SUMS
└── weekly/2026-08-02T02-30-00Z/
```

Sunday runs are written to `weekly/`, every other day to `daily/`.

## Retention

| Tier | Default | Override |
| --- | --- | --- |
| daily | 14 dumps | `BLUZ_KEEP_DAILY` |
| weekly | 8 dumps | `BLUZ_KEEP_WEEKLY` |

Pruning runs at the end of every backup, keeping the newest N directories per
tier.

## Off-host storage

`BLUZ_BACKUP_DIR` must point at storage **outside the app host's lifecycle** —
an NFS/SMB mount, an attached volume on a different machine, or a directory
synced off-box afterwards. A dump sitting on the same disk as the Docker
volumes does not survive the failure it exists to protect against.

If you sync to object storage, append to `bluz-backup.service`:

```ini
ExecStartPost=/usr/bin/rclone sync /var/backups/bluz remote:bluz-backups
```

## Restore runbook

1. **Pick the dump.** `ls -1 /var/backups/bluz/daily /var/backups/bluz/weekly`.
2. **Verify integrity before touching production.**
   `cd <dump-dir> && grep -v 'SHA256SUMS$' SHA256SUMS | sha256sum -c -`
   (`bluz-restore.sh` does this automatically.)
3. **Announce downtime.** The restore stops `ui` and `sessions`.
4. **Run the restore.**
   ```bash
   sudo ./deploy/backup/bluz-restore.sh /var/backups/bluz/daily/<stamp>
   ```
   It prompts for the literal word `RESTORE`. Pass `--yes` to skip the prompt in
   an automated drill.
5. **Restore one engine only** when only one is damaged:
   `--postgres-only` or `--mongo-only`.
6. **Verify.** Log in, open the schedule (MongoDB) and a curriculum (Postgres).
   Check row counts against the expected day.
7. **Record the drill** — date, dump used, duration, anything that surprised you.

### What the restore does

- Drops and recreates the Postgres database (`DROP DATABASE ... WITH (FORCE)`
  terminates lingering connections), then `pg_restore --no-owner`.
- `mongorestore --drop`, which drops each collection present in the archive.
  Collections created *after* the dump are **not** removed.
- Stops `ui`/`sessions` first so nothing writes into a half-restored database,
  and starts them again at the end.

### Testing without touching production

Point the scripts at a scratch stack:

```bash
BLUZ_COMPOSE_FILE=deploy/docker-compose.local.yml \
BLUZ_BACKUP_DIR=/tmp/bluz-drill \
    ./deploy/backup/bluz-backup.sh

BLUZ_COMPOSE_FILE=deploy/docker-compose.local.yml \
    ./deploy/backup/bluz-restore.sh /tmp/bluz-drill/daily/<stamp> --yes
```

An untested backup is not a backup. Run a drill at least once per term.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `FATAL: ... is empty` | `docker compose exec` failed but the pipe still created the file | Check the container is healthy: `docker compose ps` |
| `pg_restore: error: could not execute query ... already exists` | Restored over a live database instead of a fresh one | Use `bluz-restore.sh`, which drops first |
| `mongorestore: Failed: ... Authentication failed` | `MONGO_ROOT_USER`/`MONGO_ROOT_PASSWORD` missing from `.env` | Export them or fix `.env` |
| Timer never fires | Timer not enabled | `systemctl enable --now bluz-backup.timer` |
