# Upgrading

## v0.2.0 → v0.2.1

1. Back up the existing database; keep the existing `nodvis-finance-data` volume.
2. Replace the Compose file with the current root `docker-compose.yml`.
3. At the top of the file, set `postgres-password` to the existing PostgreSQL password and `auth-secret` to the existing auth secret. Do not change either value for an existing installation.
4. Run `docker compose up -d`.
5. Open Finance on port 3990 and verify login and a known household.

This is a packaging and self-hosting UX patch. No application feature or database migration is included.

## v0.1.3 → v0.2.0

1. Back up the existing database with the v0.1.3 deployment.
2. Keep the existing PostgreSQL volume; never use `down -v`.
3. Set the Finance image to `ghcr.io/nodvis/finance:0.2.0`.
4. Keep the existing PostgreSQL credentials, database name and user.
5. Run `docker compose up -d`; startup applies additive migrations `0032`–`0036` before serving requests.
6. Open Finance on port 3990 and verify login, a known household, account and transaction.
7. Verify Net Worth/history, Goals, Budgets, Splits, Forecast and Planning.
8. Open Settings and verify that the running version shows `v0.2.0`.

Planning V1 is read-only deterministic guidance. Persistent envelope allocation, rollover and available-to-assign ledgers are not part of v0.2.0.

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
