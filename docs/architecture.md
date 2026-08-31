# Architecture

> Status: accepted foundation architecture. Significant changes require an ADR.

## Current shape

Nodvis Finance is a **self-hosted modular monolith** implemented as a small pnpm workspace.

```text
Browser
   |
   | HTTPS
   v
Reverse proxy / VPN / private network boundary
   |
   v
apps/web — Next.js 16 / React 19
   |
   +--> packages/domain — framework-independent financial rules
   |
   +--> packages/db — PostgreSQL / Drizzle persistence
   |
   v
PostgreSQL 18
```

The boundaries are logical and source-level. They do not imply separate runtime services.

## Repository boundaries

```text
apps/
  web/       UI, routing, server operations, auth integration

packages/
  domain/    financial value objects, invariants and deterministic calculations
  db/        PostgreSQL schema, migrations and database access
```

### `packages/domain`

This is the highest-value correctness boundary.

It must remain independent from:

- Next.js,
- React,
- Better Auth,
- Drizzle/PostgreSQL implementation details,
- presentation formatting.

Canonical money arithmetic uses integer minor units represented by `bigint` plus an explicit currency code. Never use JavaScript floating-point `number` as the canonical representation of money.

### `packages/db`

Owns:

- PostgreSQL schema,
- Drizzle access,
- committed/reviewed migrations,
- persistence-specific constraints.

Database convenience must not redefine financial semantics. The domain model wins when persistence and domain convenience conflict.

### `apps/web`

Owns:

- Next.js App Router UI,
- `pl` / `en` routing through next-intl,
- server-side application operations,
- Better Auth integration,
- authorization at resource boundaries,
- presentation formatting.

Server Components are preferred by default. Client Components are used only when browser interaction requires them.

Next.js Proxy may perform locale negotiation or coarse routing. It is **not** an authorization boundary.

## Core architectural constraints

### Self-hosted first

The first supported deployment model is private/self-hosted. Normal use must not require a Nodvis cloud service.

Recommended exposure:

- LAN,
- VPN/Tailscale,
- reverse proxy + TLS.

A raw public `http://server:3000` deployment is not a supported recommendation.

### Standalone application boundary

Finance remains isolated from Recall and other Nodvis products:

- separate repository,
- separate database,
- separate secrets,
- separate auth configuration/tables,
- no shared persistence model,
- no mandatory runtime dependency on another Nodvis application.

Future integration must use explicit interfaces rather than shared database access.

### Core works without external AI

The financial model, imports, reconciliation, categorization rules, forecasting and debt simulations must work without external LLM APIs or paid AI services.

External AI may later be an explicit opt-in helper, never a hidden core dependency.

### Internationalization is foundational

Polish and English exist from the application scaffold.

User-visible handling of:

- strings,
- dates,
- numbers,
- currencies

must be locale-aware.

### Domain semantics over generic ledger abstractions

Preserve distinctions such as:

- planned obligation vs actual transaction,
- available cash vs outstanding debt,
- expense vs transfer,
- credit-card purchase vs card repayment,
- loan principal reduction vs interest expense,
- account owner vs payer/beneficiary context.

### Import provenance and reconciliation

Imported data must retain a trace from source evidence/raw records to normalized domain records. Repeated or overlapping imports are expected, so idempotency, deduplication and reviewable uncertain matches are design requirements.

### Sensitive documents are deferred behind a security decision

Do not add generic production file upload before decisions exist for:

- storage location,
- encryption/key management,
- access control,
- validation and malicious-file handling,
- backup/restore,
- retention/deletion.

### Backup and restore are architecture features

Production readiness requires a coherent, testable backup/restore path. Copying data without verifying restoration is not enough.

### Privacy-preserving defaults

Self-host defaults:

```text
analytics: off
telemetry: off
external crash reporting: off
external AI: off
```

## Deployment topology

Initial production shape:

```text
reverse proxy / TLS
        |
        v
Finance web container
        |
        v
PostgreSQL container/service
```

Docker Compose is the reference deployment mechanism.

Do not add by default:

- Redis,
- RabbitMQ,
- Kafka,
- Kubernetes,
- a separate API/backend service,
- object storage.

Introduce additional infrastructure only when a concrete requirement justifies it and record the decision when material.

## Persistence rules

- PostgreSQL 18 is the supported primary database.
- Drizzle stable is the initial SQL/ORM layer.
- SQL migrations are generated, reviewed, tested and committed.
- `drizzle-kit push` is not a production migration strategy.
- Dates and timestamps must preserve source semantics rather than invent precision.
- Financial amounts must never rely on floating-point storage/arithmetic.

## Authentication and authorization

Better Auth is the selected authentication library.

Authentication does not replace authorization. Every privileged server operation must verify access to the relevant household/resource at the operation/data boundary rather than relying on UI visibility, client state, layouts or Proxy.

## Decisions still requiring ADRs

Before the relevant feature ships:

- document storage,
- encryption/key management,
- backup/restore format and verification,
- durable background jobs if required,
- external/public API boundaries if introduced,
- strong-auth enrollment/recovery policy.

## Architecture bias

Until evidence proves otherwise:

- prefer a simple deployable system over microservices,
- prefer explicit domain code over infrastructure cleverness,
- prefer deterministic behavior over opaque automation,
- prefer auditable/recoverable operations over destructive convenience,
- preserve uncertainty rather than fabricate financial facts.

See `docs/adr/` for the accepted decisions behind this architecture.
