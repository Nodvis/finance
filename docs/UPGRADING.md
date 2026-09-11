# Upgrading

## v0.1.2 → v0.1.3

1. Back up the existing database with the old deployment.
2. Keep the existing PostgreSQL volume; never use `down -v`.
3. Replace the old Compose file with the root `docker-compose.yml`.
4. Keep the existing PostgreSQL credentials, database name and user.
5. Set the Finance image to `ghcr.io/nodvis/finance:0.1.3`.
6. Run `docker compose up -d`.
7. Open Finance on port 3990 and verify login, a known household, account and transaction.
8. Open Settings and verify that the running version shows `v0.1.3`.

No new database migration is included in v0.1.3. The Finance container continues to listen on port `3990`, waits for PostgreSQL, runs any pending migrations through Drizzle's migration journal, and starts the web process only after migration succeeds. Existing data remains in the PostgreSQL volume; users previously accessing port 3000 must use port 3990.

Back up before every update. If startup fails, inspect `docker compose logs finance`, stop the service and restore the verified backup before investigating. Do not use `drizzle-kit push` or delete the database volume.
