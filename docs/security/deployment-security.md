# Deployment security

The Finance image runs as a non-root user. The default Compose deployment is intentionally straightforward; PostgreSQL has no host port in `docker-compose.yml`, while the Finance port is exposed for LAN access and should be restricted by firewall, VPN or reverse proxy.

The private deployment currently uses HTTP on the LAN. HSTS is intentionally absent until HTTPS is actually deployed. For remote or hostile networks, terminate TLS at a trusted reverse proxy/VPN and configure Better Auth/app URLs and Secure cookies consistently.

Do not use `docker compose down -v` on the private project. Before an update, create and verify a backup. Start the Finance image with `docker compose up -d`; it waits for PostgreSQL and applies additive migrations before serving requests. Verify the healthcheck and migration journal, then test a known account and transaction.

## Optional Docker hardening

Operators may add `no-new-privileges`, drop all capabilities, use a read-only root filesystem and mount a restricted `/tmp` tmpfs for the Finance service. These restrictions are not required by the supported copy/paste installation and should be validated against the local Docker/host environment before use.
