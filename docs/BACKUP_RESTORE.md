# Backup and restore

Backups contain account balances, transactions, household membership and authentication data. Protect them like the live database.

## Backup

1. From the directory containing the Compose file and `.env`, run `./scripts/backup.sh backup.sql` (or set `COMPOSE_ENV_FILE=/path/to/.env`).
2. Check that the file is non-empty and store it in protected offline or separately managed storage.
3. Keep multiple generations and test restoration regularly.

## Restore checklist

1. Stop `web` and make a separate copy of the current database/volume if it must be preserved.
2. Start PostgreSQL only.
3. Restore with `CONFIRM_RESTORE=yes COMPOSE_ENV_FILE=/path/to/.env ./scripts/restore.sh backup.sql`.
4. Run pending migrations if the backup predates the target release.
5. Start `web` and verify login, household, account balance and a known transaction.

Always test this procedure first against a disposable Compose project. Never run `down -v` against a valuable deployment.
