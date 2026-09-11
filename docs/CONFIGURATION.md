# Configuration

The canonical `docker-compose.yml` is designed for copy/paste installation and does not require an external `.env` file.

## Values to change

- `CHANGE_ME_DATABASE_PASSWORD` — strong random PostgreSQL password. Use the same value in `POSTGRES_PASSWORD` and `DB_PASSWORD`.
- `CHANGE_ME_AUTH_SECRET` — a different random secret of at least 32 random bytes.

Optional:

- both `SERVER-IP` URL values — replace them with the IP address/hostname of the Docker server or the same HTTPS reverse-proxy URL;
- `ghcr.io/nodvis/finance:<version>` — pin a newer release during an update;
- `ALLOW_SIGN_UP` — set to `"false"` after the first owner account exists.

No `DATABASE_URL` is needed in the public Compose file. Finance safely constructs it from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` at startup. `NODE_ENV`, `PORT` and `HOSTNAME` are already set by the production image.

Development uses `.env.example` and `docker-compose.dev.yml`; those settings are separate from the public self-hosting path.
