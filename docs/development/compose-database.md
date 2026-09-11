# Database connection contexts

Nodvis Finance uses separate connection endpoints for host-side development and the persistent Compose project.

- Host-side `.env` uses `localhost:5432`, which is the port published by `docker-compose.dev.yml`.
- The persistent private `.env.private` uses the Compose service endpoint `postgres:5432`.
- The `finance` service constructs `DATABASE_URL` at startup from DB variables and resolves `postgres` inside the Compose network.
- Disposable PostgreSQL tests must pass their own process-local `DATABASE_URL`; they must not reuse `.env.private` or the private Compose project.

Verify a resolved configuration without printing credentials:

```bash
unset DATABASE_URL

docker compose --env-file .env.private -f docker-compose.yml config --format json \
  | python3 -c 'import json,sys; p=json.load(sys.stdin); print("services:", ", ".join(p["services"]))'
```

Before a private update, back up first and run `docker compose up -d`; read back both the migration journal and expected schema objects from the `postgres` service. Do not use `drizzle-kit push`, `down -v`, manual migration markers or a host-loopback URL from inside a container.
