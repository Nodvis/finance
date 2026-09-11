# Backup and restore

Backups contain account balances, transactions, household membership and authentication data. Protect them like the live database.

## Backup

From the directory containing `docker-compose.yml` and the scripts:

```bash
./backup.sh backup.sql
```

The script uses the `postgres` service in the canonical Compose file and verifies that the dump is non-empty. Store multiple generations outside the application host where possible.

## Restore checklist

1. Make a separate copy of the current backup if it must be preserved.
2. Ensure PostgreSQL is running and Finance is stopped by the restore script.
3. Run `CONFIRM_RESTORE=yes ./restore.sh backup.sql`.
4. Start Finance with `docker compose up -d`.
5. Verify login, a known account balance and a known transaction.

The restore confirmation is intentionally destructive. Never use `docker compose down -v` against a valuable deployment.
