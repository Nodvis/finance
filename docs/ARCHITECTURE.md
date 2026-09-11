# Architecture at a glance

Nodvis Finance is a Next.js modular monolith with three workspace packages:

- `apps/web` — localized App Router UI and authorized server operations.
- `packages/domain` — framework-independent exact-money and financial rules.
- `packages/db` — PostgreSQL schema, Drizzle migrations and household-scoped access.

Canonical money is integer minor units with an explicit currency. Transactions are ledger truth; obligations and recurring definitions are planning metadata; forecasts are read models. Household authorization is checked at server/service boundaries. PostgreSQL migrations are committed SQL artifacts and run by the dedicated migration service.

See the ADRs and `SECURITY.md` for deployment and threat-model details.
