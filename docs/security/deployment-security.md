# Deployment security

The reference Compose deployment runs the Finance service as a non-root image user with `no-new-privileges`, all capabilities dropped, read-only root filesystem and restricted `/tmp`. PostgreSQL has no host port in `docker-compose.yml`; the web port is exposed for LAN access and should be restricted by firewall, VPN or reverse proxy.

The private deployment currently uses HTTP on the LAN. HSTS is intentionally absent until HTTPS is actually deployed. For remote or hostile networks, terminate TLS at a trusted reverse proxy/VPN and configure Better Auth/app URLs and Secure cookies consistently.

Do not use `docker compose down -v` on the private project. Before an update, create and verify a backup. Start the Finance image with `docker compose up -d`; it waits for PostgreSQL and applies additive migrations before serving requests. Verify the healthcheck and migration journal, then test a known account and transaction.
