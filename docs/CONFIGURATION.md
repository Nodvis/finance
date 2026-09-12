# Configuration

The canonical `docker-compose.yml` is designed for copy/paste installation and does not require an external `.env` file.

## Values to change

- `POSTGRES_PASSWORD` — the single operator-facing strong random PostgreSQL password. Compose injects it into Finance's `DB_PASSWORD` automatically.
- `BETTER_AUTH_SECRET` — a different random secret of at least 32 random bytes, supplied as a Compose stack/environment variable.

Optional:

- `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` — optional canonical URL values for HTTPS reverse-proxy deployments; direct access derives the request origin and does not require them;
- `ghcr.io/nodvis/finance:<version>` — pin a newer release during an update; production Finance listens on port `3990`;
- `BETTER_AUTH_TRUSTED_ORIGINS` — comma-separated additional explicit HTTPS origins when a deployment intentionally serves more than one origin;
- `BETTER_AUTH_TRUSTED_PROXY_HEADERS` — set to `true` only when a trusted reverse proxy controls `x-forwarded-host` and `x-forwarded-proto`;


No `DATABASE_URL` is needed in the public Compose file. `DB_PORT` remains explicit because the v0.1.3 image requires it; Finance safely constructs the database URL at startup. The production image sets `NODE_ENV`, `PORT=3990` and `HOSTNAME` internally.

Production rejects short, placeholder and known test auth secrets before starting. Generate one with `openssl rand -hex 32`. Development uses `.env.example` and `docker-compose.dev.yml`; those settings are separate from the public self-hosting path.
