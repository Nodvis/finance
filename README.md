# Nodvis Finance

A self-hosted household finance app for tracking money, upcoming payments and your near-term cash position.

[![Version](https://img.shields.io/github/v/release/Nodvis/finance?label=version)](https://github.com/Nodvis/finance/releases) [![Docker](https://img.shields.io/badge/Docker-amd64%20%2F%20arm64-2496ED?logo=docker&logoColor=white)](https://github.com/Nodvis/finance/pkgs/container/finance) [![License](https://img.shields.io/badge/license-AGPL--3.0--only-blue)](LICENSE)

Nodvis Finance is one product in the broader Nodvis ecosystem. Nodvis Recall is a separate product coming later.

## What can I do with it?

- Accounts and balances
- Income, expenses and transfers
- Transaction search, filters and CSV import/export
- Upcoming payments and recurring bills
- Debts and repayments
- 7- and 30-day cash forecast
- Polish and English interface

## Quick Start

### Portainer / Dockge

1. Copy the complete [`docker-compose.yml`](docker-compose.yml) into **Stacks → Add stack → Web editor** (Portainer), or into a new Compose project (Dockge).
2. Replace these values:
   - `CHANGE_ME_DATABASE_PASSWORD`
   - `CHANGE_ME_AUTH_SECRET`
   - `SERVER-IP` with the IP address or hostname of the machine running Docker
3. Click **Deploy**.
4. Open `http://SERVER-IP:3000`.

Use a different random value for each secret. For example, generate one with `openssl rand -hex 32`. PostgreSQL is the internal database used by Finance. Your data is stored in the named Docker volume `nodvis-finance-data`; do not delete it unless you intentionally want to delete your Finance data.

### Docker Compose

Save the same file as `docker-compose.yml`, replace the values above, and run:

```bash
docker compose up -d
```

That is the only normal startup command. PostgreSQL has no host port. For a domain or reverse proxy, replace both `SERVER-IP` URLs with the same canonical URL, for example `https://finance.example.com`.

```yaml
services:
  finance:
    image: ghcr.io/nodvis/finance:0.1.1
    container_name: nodvis-finance
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_NAME: nodvis_finance
      DB_USER: nodvis_finance
      DB_PASSWORD: "CHANGE_ME_DATABASE_PASSWORD"
      BETTER_AUTH_SECRET: "CHANGE_ME_AUTH_SECRET"
      BETTER_AUTH_URL: "http://SERVER-IP:3000"
      NEXT_PUBLIC_APP_URL: "http://SERVER-IP:3000"
      ALLOW_SIGN_UP: "true"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:18.6-alpine
    container_name: nodvis-finance-db
    environment:
      POSTGRES_DB: nodvis_finance
      POSTGRES_USER: nodvis_finance
      # Use the same password in both database password fields.
      POSTGRES_PASSWORD: "CHANGE_ME_DATABASE_PASSWORD"
    volumes:
      - nodvis-finance-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nodvis_finance -d nodvis_finance"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  nodvis-finance-data:
```

The Finance image waits for PostgreSQL, runs migrations automatically, and starts the application only after migrations succeed. You do not run a migration command.

### Optional hardening

Operators who want stricter container restrictions can add `no-new-privileges`, dropped capabilities, a read-only root filesystem and a restricted `/tmp` tmpfs to the Finance service. These are optional Docker hardening settings, not required for the normal installation.

## First account

The example allows registration for first setup. Create the owner account in the browser, then set `ALLOW_SIGN_UP` to `"false"` in the Compose file and redeploy the Finance service. This closes public registration while keeping existing users. Broader signup is never enabled automatically.

## System requirements

Measured on a disposable synthetic household stack after warm-up; actual needs depend on household size, history and backups.

### Minimum

- CPU: 2 vCPU
- RAM: 1 GB
- Storage: 4 GB free
- Architecture: amd64 or arm64

### Recommended

- CPU: 2 vCPU
- RAM: 2 GB
- Storage: 10 GB+
- Architecture: amd64 or arm64

For details and measurement methodology see [system requirements](docs/SYSTEM_REQUIREMENTS.md).

## Backup, restore and updates

If you installed only the Compose file, download the two helper scripts once. Replace `SERVER-IP` only in the application URL fields; the helper commands use the Compose service names.

```bash
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.1.1/scripts/backup.sh
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.1.1/scripts/restore.sh
chmod +x backup.sh restore.sh
```

```bash
./backup.sh backup.sql
CONFIRM_RESTORE=yes ./restore.sh backup.sql
```

Back up before every update. Change the Finance image tag in `docker-compose.yml`, then run `docker compose up -d` again. The container migrates the existing database before starting. See [self-hosting](docs/SELF_HOSTING.md), [backup and restore](docs/BACKUP_RESTORE.md) and [upgrading](docs/UPGRADING.md).

## Security and privacy

Self-hosted means the operator controls the database, backups, network and logs. Never expose PostgreSQL publicly. Use HTTPS or a private network for remote access. No mandatory AI, telemetry or paid API is required. Read [SECURITY.md](SECURITY.md).

## Product website and documentation

- Product website: https://finance.nodvis.com
- Documentation/wiki: https://finance.nodvis.dev
- Source and releases: https://github.com/Nodvis/finance
- Demo: coming soon; no unsafe writable demo is published

## Development

Requirements: Node.js 24 LTS, pnpm 11.24.0 and Docker Compose.

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
pnpm dev
```

For architecture, exact-money rules, security, contribution and support, see the [documentation](docs/).

## Support and bug reports

For a product problem, open an issue at https://github.com/Nodvis/finance/issues. Do not include passwords, tokens, private URLs, database dumps or real financial data. Security vulnerabilities belong in [SECURITY.md](SECURITY.md), not a public issue.

## Support Nodvis

- Patreon: https://www.patreon.com/9Erza
- Buy Me a Coffee: https://www.buymeacoffee.com/9erza

## License and brand

Nodvis Finance Core is [AGPL-3.0-only](LICENSE). Nodvis is the umbrella brand; Nodvis Finance and Nodvis Recall are separate product names. See [TRADEMARKS.md](TRADEMARKS.md).
