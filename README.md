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

The normal installation is one Compose file, two secrets and one deploy action. PostgreSQL is the database; Nodvis Finance is the application. The Finance container waits for PostgreSQL, applies its own migrations, then starts the app.

### Portainer / Dockge

1. Add a new Stack or Compose project.
2. Copy the complete [`docker-compose.yml`](docker-compose.yml) below into the editor.
3. Change the two values marked `CHANGE_ME`. Change the URL anchor too if you use a domain or want the LAN address shown in links.
4. Click **Deploy**.
5. Open `http://SERVER-IP:3000`.

The database is stored in the named volume `nodvis-finance-data`. **Do not delete this volume unless you intentionally want to delete your Finance data.**

### Docker Compose

Save the same file as `docker-compose.yml`, edit the marked values and run:

```bash
docker compose up -d
```

That is the only startup command. Open `http://SERVER-IP:3000`; for internet exposure use HTTPS through a reverse proxy or VPN. PostgreSQL has no host port.

<details>
<summary>Complete docker-compose.yml</summary>

```yaml
# Nodvis Finance — copy this file into Dockge, Portainer or a folder.
# Change the two required secrets below. Set the URL only when using a domain.
x-db-password: &db-password "CHANGE_ME_DATABASE_PASSWORD"
x-auth-secret: &auth-secret "CHANGE_ME_AUTH_SECRET"
x-app-url: &app-url "http://localhost:3000"

services:
  postgres:
    image: postgres:18.6-alpine
    container_name: nodvis-finance-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: nodvis_finance
      POSTGRES_USER: nodvis_finance
      # REQUIRED: change this to a strong random password.
      POSTGRES_PASSWORD: *db-password
    volumes:
      - nodvis-finance-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 5s

  finance:
    image: ghcr.io/nodvis/finance:0.1.1
    container_name: nodvis-finance
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_NAME: nodvis_finance
      DB_USER: nodvis_finance
      DB_PASSWORD: *db-password
      # REQUIRED: change this to another strong random secret.
      BETTER_AUTH_SECRET: *auth-secret
      BETTER_AUTH_URL: *app-url
      NEXT_PUBLIC_APP_URL: *app-url
      # First account setup: leave true until the owner account exists,
      # then change to false and recreate the finance service.
      ALLOW_SIGN_UP: "true"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health > /dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 30s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:size=64m,noexec,nosuid,nodev

volumes:
  nodvis-finance-data:
```

</details>

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

If you installed only the Compose file, download the two helper scripts once:

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
