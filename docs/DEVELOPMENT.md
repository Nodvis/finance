# Development

Requirements: Node.js 24 LTS, pnpm 11.24.0 and Docker Compose.

```bash
pnpm install
cp .env.example .env
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm dev
```

Quality gates:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Read `AGENTS.md`, the domain documentation and relevant ADRs before changing financial behavior. Use disposable PostgreSQL for migration and browser verification. Never use private deployment data in fixtures.
