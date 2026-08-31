# ADR-0006: Persistence and money representation

- Status: Accepted
- Date: 2026-08-31

## Context

Nodvis Finance stores sensitive household financial data and must preserve financial semantics accurately. The persistence layer must support relational integrity, auditable migrations, deterministic local/self-hosted operation and explicit SQL-level constraints where practical.

Money handling must not depend on JavaScript floating-point arithmetic.

## Decision

### Database

Use **self-hosted PostgreSQL 18** as the primary database.

For local development and the initial supported self-host deployment, target the current supported PostgreSQL 18 minor release.

Do not support SQLite as a production persistence mode for the MVP. A single persistence model avoids subtle behavioral differences in constraints, date/time behavior and migrations.

### ORM/query layer

Use the current stable **Drizzle ORM 0.45.x** line with the stable **Drizzle Kit 0.31.x** line.

Do not adopt Drizzle 1.0 RC/beta releases in production until a stable 1.x release and migration path have been evaluated.

Reasons:

- SQL remains visible and reviewable,
- schema definitions stay in TypeScript,
- generated SQL migrations can be committed and reviewed,
- PostgreSQL-specific constraints remain accessible,
- the layer is small enough that domain behavior does not need to be expressed through ORM magic.

### Migration policy

The codebase is schema-first/code-first, but **SQL migrations are committed artifacts**.

Normal workflow:

```text
schema change
  -> drizzle-kit generate
  -> review generated SQL
  -> test migration
  -> commit migration
  -> drizzle-kit migrate
```

`drizzle-kit push` may be used only for disposable local experimentation. It is not an accepted production deployment mechanism.

Destructive migrations require explicit review and a rollback/backup plan appropriate to the change.

### Money representation

Persist monetary amounts as **integer minor units**, never floating-point values.

Conceptually:

```text
Money {
  amountMinor: bigint
  currency: ISO-4217-style currency code
}
```

Examples:

```text
12.34 PLN -> 1234 minor units
100.00 EUR -> 10000 minor units
```

Application/domain code uses `bigint` for exact arithmetic. Formatting to `12,34 zł`, `€100.00`, etc. happens only at presentation boundaries through locale-aware formatting.

Do not persist canonical financial amounts as JavaScript `number`, PostgreSQL `real` or `double precision`.

The first implementation will focus on ordinary fiat currencies. Currency metadata/decimal rules should remain explicit rather than assuming every currency always has two decimal places.

### Timestamps and dates

Use distinct types for distinct semantics:

- event/import timestamps: timezone-aware instants,
- bank transaction/posting dates: calendar dates when the source provides only a date,
- obligation due dates: calendar dates unless time-of-day is materially meaningful.

Do not invent a timestamp when the source only supplies a date.

### Database constraints

Use PostgreSQL constraints for invariants that are local to a row/relation and can be enforced safely, including examples such as:

- required currencies,
- non-null ownership references where required,
- valid enumerated/state values,
- uniqueness of source transaction identifiers within their source scope,
- import provenance relationships.

Cross-record financial semantics remain enforced in domain/application services and tests where a database constraint would be misleading or brittle.

### Import provenance

Raw/import provenance is retained independently from normalized financial records.

An imported normalized record should be traceable to at least:

- import batch,
- source/parser type,
- source filename metadata,
- source hash where available,
- parser version,
- raw source row/record,
- normalized result.

Do not destructively rewrite source evidence simply because normalization rules improve later.

## Consequences

### Positive

- Exact monetary arithmetic.
- Strong relational integrity.
- Reviewable and auditable schema evolution.
- One production database behavior across self-hosted installations.
- The persistence layer remains close to PostgreSQL rather than hiding it behind a large abstraction.

### Negative / trade-offs

- PostgreSQL is mandatory infrastructure.
- `bigint` values require deliberate JSON/API serialization because native JSON does not encode JavaScript `bigint`.
- Minor-unit currency handling needs explicit currency metadata for currencies with non-two-decimal conventions.
- Generated migrations still require human/agent review; generation is not proof of safety.

## Alternatives considered

### Prisma ORM 8

Not selected for the initial implementation. Prisma remains a credible option, but Prisma 8 is a newly introduced major architecture and the project benefits more from SQL transparency and a smaller persistence abstraction than from Prisma's generated client/contract workflow.

### SQLite

Rejected as the primary/self-hosted production store because the application already needs durable relational semantics and would otherwise need to support and test database-specific differences.

### PostgreSQL `numeric` for every amount

Exact, but integer minor units are simpler for ordinary household fiat arithmetic and make accidental floating-point conversion easier to detect. This can be revisited for domains that genuinely require arbitrary decimal precision.

## Follow-up

- Implement `Money` as a pure domain type with tests.
- Define the first small PostgreSQL schema only for Phase 1 entities; do not create every future table immediately.
- Add migration review rules to `AGENTS.md`.
