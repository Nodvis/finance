# Upgrading

## v0.1.0 → v0.1.1

1. Back up the existing database with the old deployment.
2. Keep the existing PostgreSQL volume; never use `down -v`.
3. Replace the old Compose file with the root `docker-compose.yml`.
4. Copy the same PostgreSQL credentials into `POSTGRES_PASSWORD` and `DB_PASSWORD`, and keep the existing database name/user.
5. Set the Finance image to `ghcr.io/nodvis/finance:0.1.1`.
6. Run `docker compose up -d`.
7. Wait for the Finance healthcheck and verify a known household, account and transaction.

The v0.1.1 Finance container waits for PostgreSQL, runs pending migrations once through Drizzle's migration journal, and starts the web process only after migration succeeds. Existing data remains in `nodvis-finance-data`.

Back up before every update. If startup fails, inspect `docker compose logs finance`, stop the service and restore the verified backup before investigating. Do not use `drizzle-kit push` or delete the database volume.
