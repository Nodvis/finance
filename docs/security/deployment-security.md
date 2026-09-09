# Deployment security

The reference Compose deployment runs the web service as a non-root image user with `no-new-privileges`, all capabilities dropped, read-only root filesystem and restricted `/tmp`. PostgreSQL has no host port in `compose.yaml`; the web port is configurable and must remain LAN/VPN/reverse-proxy scoped.

The private deployment currently uses HTTP on the LAN. HSTS is intentionally absent until HTTPS is actually deployed. For remote or hostile networks, terminate TLS at a trusted reverse proxy/VPN and configure Better Auth/app URLs and Secure cookies consistently.

Do not use `docker compose down -v` on the private project. Before migrations, create and verify a backup, apply additive migrations through the migrator, repeat the migration idempotently, then rebuild only the required service.
