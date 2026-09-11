# Self-hosting Nodvis Finance

Nodvis Finance is a two-container self-hosted deployment: the `finance` application and internal PostgreSQL storage. You do not run migrations manually.

## Installation

1. Copy the complete root [`docker-compose.yml`](../docker-compose.yml) into Dockge, Portainer or a new directory.
2. Replace `CHANGE_ME_DATABASE_PASSWORD`, `CHANGE_ME_AUTH_SECRET` and `SERVER-IP`. Use the same database password in both database password fields. Replace `SERVER-IP` with the IP address or hostname of the machine running Docker.
3. Deploy, or run `docker compose up -d`.
4. Open `http://SERVER-IP:3990`.

PostgreSQL is not exposed on a host port. The single named volume `nodvis-finance-data` contains your Finance database. Do not delete it unless you intentionally want to delete your Finance data.

At startup the Finance container validates configuration, waits for PostgreSQL, applies pending migrations, and only then starts the web server. A migration error stops Finance and is visible in its logs.

## First account

The canonical example temporarily allows the first account to be created. Create the owner account, change `ALLOW_SIGN_UP` to `"false"`, and redeploy Finance. Do not leave open registration enabled on an internet-facing deployment.

Automatic zero-user bootstrap is not enabled in this release because Better Auth's signup switch is process configuration, not a transactional per-request policy. The explicit close-after-first-account step is the safe supported workflow.

## Internet access

Use HTTPS through a reverse proxy or a VPN. Do not expose PostgreSQL. The default `3990:3990` mapping is intentional for LAN access and can be restricted at the host firewall or reverse proxy.

## Updates

1. Run `./backup.sh backup.sql` from the directory containing `docker-compose.yml` and the downloaded helper scripts.
2. Change `ghcr.io/nodvis/finance:0.1.2` to the target release in `docker-compose.yml`.
3. Run `docker compose up -d` again.
4. Open Finance on port 3990 and verify a known account and transaction.

The same Finance image performs any required migration before serving requests. Keep the same Compose project and `nodvis-finance-data` volume.

For the tested `v0.1.0` to `v0.1.1` transition, see [UPGRADING.md](UPGRADING.md).

## Backups

If you copied only the Compose file, download the helpers next to it:

```bash
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.1.2/scripts/backup.sh
curl -fsSLO https://raw.githubusercontent.com/Nodvis/finance/v0.1.2/scripts/restore.sh
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
