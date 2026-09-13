# Self-hosting Nodvis Finance

Nodvis Finance is a two-container self-hosted deployment: the `finance` application and internal PostgreSQL storage. You do not run migrations manually.

## Installation

1. Copy [`docker-compose.yml`](../docker-compose.yml) into a new directory.
2. Edit `postgres-password` and `auth-secret` in the top-level `x-config` block; the auth secret must contain at least 32 characters.
3. Run `docker compose pull`, `docker compose up -d` and `docker compose ps`.
4. Open `http://<docker-host>:3990`.

PostgreSQL is not exposed on a host port. The single named volume `nodvis-finance-data` contains your Finance database. Do not delete it unless you intentionally want to delete your Finance data.

Direct access on a private LAN hostname or IP is supported without copying the host into Compose. Nodvis accepts only validated loopback/RFC1918/ULA hosts on port `3990`; arbitrary public hostnames remain rejected unless a reverse proxy supplies an explicit `BETTER_AUTH_URL`.

At startup the Finance container validates configuration, waits for PostgreSQL, applies pending migrations, and only then starts the web server. A migration error stops Finance and is visible in its logs. Compose reports Finance as healthy only after `/api/health` returns an OK status.

## First account

Fresh empty installations open a localized setup wizard instead of a generic sign-in/sign-up screen. The wizard creates the first owner and household and closes public registration automatically. A bootstrap race is serialized in PostgreSQL; only one visitor can claim the first owner slot.

Existing installations are not reset or reinitialized. The bootstrap state is derived from the persisted instance state and existing authentication records.

## Internet access

Use HTTPS through a reverse proxy or a VPN. Do not expose PostgreSQL. The default `3990:3990` mapping is intentional for LAN access and can be restricted at the host firewall or reverse proxy.

## Updates

1. Run `./backup.sh backup.sql` from the directory containing `docker-compose.yml` and the downloaded helper scripts.
2. Change the Finance image tag in `docker-compose.yml` to the target release, preserving both existing top-level secret values.
3. Run `docker compose up -d` again.
4. Open Finance on port 3990 and verify a known account and transaction.

The same Finance image performs any required migration before serving requests. Keep the same Compose project and `nodvis-finance-data` volume.

For the current `v0.1.2` to `v0.1.3` transition, see [UPGRADING.md](UPGRADING.md).

## Backups

If you copied only the Compose file, download the helpers next to it:

```bash
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.2.3/scripts/backup.sh
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.2.3/scripts/restore.sh
chmod +x backup.sh restore.sh
```

From the directory containing `docker-compose.yml` and the scripts:

```bash
./backup.sh backup.sql
CONFIRM_RESTORE=yes ./restore.sh backup.sql
```

Restore stops Finance first, restores PostgreSQL, and leaves Finance stopped. Run `docker compose up -d` afterward, then verify the result. Backups contain sensitive financial and authentication data.

For product problems use https://github.com/Nodvis/finance/issues. Never publish private financial data or credentials in an issue.

## Optional Docker hardening

The default Compose file is intentionally easy to copy and deploy. Operators who want stricter restrictions can add `no-new-privileges`, dropped capabilities, a read-only root filesystem and a restricted `/tmp` tmpfs to the `finance` service. These settings are optional and should be tested with the chosen Docker/host setup.
