# Changelog

## [0.1.1] — Single-image self-hosting patch

This patch completes the first public self-hosting experience.

- One `ghcr.io/nodvis/finance` image waits for PostgreSQL, migrates safely, then starts Finance.
- One root `docker-compose.yml` works in Docker Compose, Dockge and Portainer.
- Secrets are entered once and the database URL is constructed safely at startup.
- Self-hosting, backup/restore, upgrade and system-requirement guidance is simplified.

Upgrade from `v0.1.0` by keeping the PostgreSQL volume, replacing the Compose file and running `docker compose up -d`.

## [0.1.0] — First public release

Nodvis Finance is an open-source, self-hosted household finance application.

Highlights:

- Polish and English household finance UI.
- Accounts, balances, categories, income, expenses and transfers.
- CSV import with review and provenance.
- Obligations, recurring payments, occurrence overrides and skipped occurrences.
- Liabilities, repayments and transaction audit history.
- Deterministic 7- and 30-day cash forecast with currency separation.
- Transaction search, filters, stable pagination and CSV export.
- PostgreSQL persistence, Docker Compose deployment and reviewed migrations.

Known limitations are documented in `SECURITY.md` and `docs/SELF_HOSTING.md`.
