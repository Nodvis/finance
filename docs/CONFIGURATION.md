# Configuration

Required production variables:

- `POSTGRES_PASSWORD` — PostgreSQL password; secret; generate a unique random value.
- `DATABASE_URL` — connection used by web and migration services; keep credentials private.
- `BETTER_AUTH_SECRET` — session signing/encryption secret; secret; use at least 32 random bytes.

Common variables:

- `POSTGRES_DB`, `POSTGRES_USER` — database name and role.
- `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` — canonical browser URL.
- `WEB_PORT` — host port, default `3000`.
- `WEB_BIND_ADDRESS` — bind address, default `127.0.0.1`.
- `ALLOW_SIGN_UP` — default `false`; enable only for a controlled bootstrap window.
- `FINANCE_VERSION` — pinned release tag for the published image.

Do not commit `.env`. The examples are placeholders and are not production secrets.
