# Self-hosting Nodvis Finance

Nodvis Finance is designed for a private single-server deployment. The supported reference is Docker Compose with PostgreSQL.

## Before you start

Use a trusted host or private network. For remote access, put the application behind HTTPS or a VPN. Do not expose PostgreSQL to the internet.

Create an environment file from `.env.production.example`. Set `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` to unique random values; never use the examples in production. Generate them with `openssl rand -base64 32`.

## CLI deployment

The release Compose file uses the published image `ghcr.io/nodvis/finance:<version>` and a named PostgreSQL volume. Set `FINANCE_VERSION` to a pinned release, then:

```bash
cp .env.production.example .env
# edit .env, including secrets and FINANCE_VERSION
export FINANCE_VERSION=0.1.0
docker compose -f compose.release.yaml up -d postgres
docker compose -f compose.release.yaml --profile migration run --rm migrate
docker compose -f compose.release.yaml up -d web
docker compose -f compose.release.yaml ps
```

Open the configured `WEB_PORT`. Enable signup only during initial bootstrap, then set `ALLOW_SIGN_UP=false` and recreate the web service.

## Portainer / Dockge

Create a Stack from `compose.release.yaml`, paste the contents into the editor, and fill the variables from `.env.production.example`. Change the image version, database password, auth secret and canonical URLs. Deploy, wait for PostgreSQL health, then run the one-shot `migrate` service once from the Stack interface before starting `web`.

PostgreSQL data lives in the named volume `nodvis-finance-postgres-data`. Do not remove that volume during ordinary updates.

## Updates

Back up first, change the pinned image version, run the migration service once, then recreate `web`. Keep the same Compose project and volume.

## Backups

Use `pg_dump` from the PostgreSQL container and store the result outside the application host when possible:

```bash
docker compose -f compose.release.yaml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > backup.sql
```

Restore only into a stopped/isolated disposable or intentionally selected database after verifying the backup file. Financial backups contain sensitive data.

See `docs/BACKUP_RESTORE.md` for a tested recovery checklist.
