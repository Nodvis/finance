# Database connection contexts

Nodvis Finance uses separate connection endpoints for host-side development and the persistent Compose project.

- Host-side `.env` uses `localhost:5432`, which is the port published by `compose.dev.yaml`.
- The persistent private `.env.private` uses the Compose service endpoint `postgres:5432`.
- Both `web` and the profiled `migrate` service receive `DATABASE_URL` from the same private Compose environment and resolve `postgres` inside the Compose network.
- Disposable PostgreSQL tests must pass their own process-local `DATABASE_URL`; they must not reuse `.env.private` or the private Compose project.

Verify a resolved configuration without printing credentials:

```bash
unset DATABASE_URL

docker compose --env-file .env.private --profile migration config --format json \
  | python3 -c 'import json,sys,urllib.parse; p=json.load(sys.stdin); [print(s, urllib.parse.urlparse(p["services"][s]["environment"]["DATABASE_URL"]).hostname, urllib.parse.urlparse(p["services"][s]["environment"]["DATABASE_URL"]).port, urllib.parse.urlparse(p["services"][s]["environment"]["DATABASE_URL"]).path.lstrip("/")) for s in ("web", "migrate")]'
```

Before a private migration, rebuild the `migrator` target from the current source, run it through the `migration` profile, and read back both the migration journal and expected schema objects from the `postgres` service. Do not use `drizzle-kit push`, `down -v`, manual migration markers or a host-loopback URL from inside a container.
