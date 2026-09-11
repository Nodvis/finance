# Nodvis Finance

Nodvis Finance is a privacy-respecting, self-hosted household finance control center. It helps a household understand available cash, upcoming obligations, debt, real spending and projected cash — without turning transfers into income or expenses.

**First public release:** `v0.1.0` · **License:** AGPL-3.0-only · **Languages:** Polski / English

Nodvis Finance is one product in the broader Nodvis ecosystem. Nodvis Recall and future products remain separate projects.

## Why Finance

- Keep available cash separate from debt outstanding.
- Treat planned obligations as planning data, not fake transactions.
- Preserve exact integer money and explicit currencies.
- Keep transfers and repayments from distorting spending.
- Self-host sensitive data in PostgreSQL.
- Work without mandatory AI, telemetry or paid APIs.

## Features

- Accounts, balances, categories, income, expenses and transfers.
- CSV import with review, provenance and deterministic duplicate protection.
- Transaction search, filters, detail/history, voiding, stable pagination and CSV export.
- Upcoming obligations and obligation history.
- Recurring obligations with per-occurrence amount/date/title/note overrides and skip.
- Liabilities and repayments with audit history.
- 7- and 30-day deterministic cash forecast, currency-separated and explicit about incomplete data.
- Polish and English localized interface.

## Quick start with Docker Compose

The release stack uses published images and does not require a source checkout.

```bash
mkdir nodvis-finance && cd nodvis-finance
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.1.0/compose.release.yaml
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.1.0/.env.production.example
cp .env.production.example .env
# Edit .env: use unique POSTGRES_PASSWORD and BETTER_AUTH_SECRET.
# Set DATABASE_URL with the same database password.
docker compose -f compose.release.yaml up -d postgres
docker compose -f compose.release.yaml --profile migration run --rm migrate
docker compose -f compose.release.yaml up -d web
```

Open `http://localhost:3000`. Set `ALLOW_SIGN_UP=true` only for initial bootstrap, then set it back to `false` and recreate `web`. For Portainer or Dockge, paste `compose.release.yaml` into a Stack and fill the same environment variables.

Read the complete [self-hosting guide](docs/SELF_HOSTING.md), [configuration](docs/CONFIGURATION.md), [backup and restore](docs/BACKUP_RESTORE.md) and [upgrade guide](docs/UPGRADING.md).

## Screenshots and demo

The application intentionally shows truthful empty states rather than invented financial values. A shared writable public demo is not included in v0.1. A future demo must use isolated synthetic data and server-enforced read-only or reset behavior; see [docs/DEMO.md](docs/DEMO.md).

## Security and privacy

Self-hosting means the deployment operator controls the database, backups, network and logs. Use HTTPS or a private network for remote access, protect `.env` and PostgreSQL backups, and never expose PostgreSQL publicly. Read [SECURITY.md](SECURITY.md) before using real financial data. No formal security certification or regulatory compliance claim is made.

## Architecture

Nodvis Finance is a Next.js modular monolith: `apps/web` contains the localized UI and authorized server operations, `packages/domain` contains framework-independent financial rules, and `packages/db` contains PostgreSQL/Drizzle persistence. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the ADRs.

## Development

Requirements: Node.js 24 LTS, pnpm 11.24.0 and Docker Compose.

```bash
pnpm install
cp .env.example .env
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm dev
```

Before changing financial behavior, read `AGENTS.md`, domain documentation and relevant ADRs. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and relevant browser tests. Use disposable databases for migrations and E2E.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bugs involving security or private financial data should be reported privately as described in [SECURITY.md](SECURITY.md).

## Roadmap

See [ROADMAP.md](ROADMAP.md). Dates are deliberately not promised. Nodvis Finance does not promise bank sync, AI categorization or hosted service availability in this release.

## Support Nodvis

Nodvis Finance remains usable without payment. Support helps maintain Finance, develop Nodvis Recall and build future open-source Nodvis projects.

- Patreon: https://www.patreon.com/9Erza
- Buy Me a Coffee: https://www.buymeacoffee.com/9erza

## License and brand

Nodvis Finance Core is licensed under [AGPL-3.0-only](LICENSE). Nodvis, Nodvis Finance and Nodvis Recall names and logos are brand identifiers; see [TRADEMARKS.md](TRADEMARKS.md).

Nodvis ecosystem: **Nodvis Finance — available** · **Nodvis Recall — coming later**.
