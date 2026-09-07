# AGENTS.md — Nodvis Finance

This file defines repository-wide instructions for AI coding agents and automated contributors.

## 1. Read before changing code

Before implementing product behavior, read:

1. `README.md`
2. `docs/product.md`
3. `docs/domain.md`
4. `docs/mvp.md`
5. `docs/threat-model.md`
6. `docs/architecture.md`
7. relevant ADRs in `docs/adr/`

For application/infrastructure work, ADR-0005 through ADR-0008 are mandatory context.

If implementation convenience conflicts with a documented financial invariant, **the invariant wins**. Change an invariant only through an explicit design decision, never silently in code.

## 2. Product goal

Nodvis Finance should help a household understand:

- money available now,
- upcoming required payments,
- debt outstanding,
- real income/spending/cash flow,
- whether the current period is financially safe,
- realistic options for improving the situation.

Do not turn the product into a generic accounting system unless a feature directly supports those goals.

## 3. Non-negotiable domain invariants

At minimum, preserve these rules:

1. A transfer is not income or expense.
2. An ATM withdrawal is a transfer into a cash account/wallet.
3. A credit-card purchase is an expense.
4. A credit-card repayment is not a second expense.
5. An obligation does not change actual account balance.
6. A real payment can settle/match an obligation.
7. Imports must not blindly duplicate existing manual/imported transactions.
8. Loan principal reduction is not interest expense.
9. Unknown cash source is a valid state.
10. A reimbursement may offset an earlier expense while preserving both cash-flow events.
11. Household and Person are distinct concepts.
12. Account ownership and transaction payer/beneficiary context are distinct concepts.
13. Debt outstanding and available cash are separate metrics.
14. Forecasts are estimates and must communicate uncertainty.

When adding tests, prioritize these invariants over superficial UI coverage.

## 4. Money rules

Canonical financial arithmetic must use the `Money` domain primitive or an explicitly approved equivalent:

```text
amountMinor: bigint
currency: explicit currency code
```

Never:

- use JavaScript `number` for canonical monetary arithmetic,
- store canonical money as PostgreSQL `real`/`double precision`,
- silently combine values with different currencies,
- assume every currency has exactly two fractional digits everywhere in the system,
- format money inside domain logic.

Locale/currency formatting belongs at presentation boundaries.

## 5. Security and privacy

Financial data is highly sensitive.

Never:

- add real statements or personal financial exports to fixtures,
- commit secrets or credentials,
- log sensitive raw documents unnecessarily,
- send complete financial data to external AI/telemetry services by default,
- invent custom cryptography without an approved design,
- expose insecure public HTTP deployment as the recommended setup.

External AI, analytics, crash reporting and telemetry default to off for self-hosted installations unless a future ADR changes that policy.

## 6. Authentication and authorization

Better Auth is the selected authentication library. Do not implement custom password/session cryptography.

Authentication is not authorization.

Every privileged server operation must validate that the current user can access the relevant household/resource at the server operation or data-access boundary.

Do not rely solely on:

- hidden UI,
- layouts,
- client-side state,
- Next.js Proxy,
- knowledge of an object ID.

Finance must not share Recall auth tables, sessions, cookies or secrets.

## 7. AI policy

The core product must work without AI and without paid APIs.

Prefer deterministic solutions for:

- parsing,
- normalization,
- matching,
- deduplication,
- categorization rules,
- forecasts,
- debt simulations.

AI may later assist with OCR/extraction/classification, but it must not become a hidden dependency of the core financial model.

## 8. Internationalization

Polish and English are foundation requirements.
Do not introduce user-facing hardcoded strings outside the next-intl message system.
All user-visible handling of:

- dates,
- numbers,
- currency,
- decimal separators,
- language strings

must be locale-aware.

Do not assume Polish formatting in domain or persistence code.

### Adding a new locale process

1. Register the new locale in `apps/web/src/i18n/config.ts` (`LOCALES` and `LOCALE_CONFIGS`).
2. Add `apps/web/messages/<locale>.json` with complete leaf key parity.
3. Verify parity using `pnpm --filter @nodvis/finance-web test src/i18n/localization.test.ts`.

### Translation definition-of-done

- Complete 100% leaf key parity between `messages/pl.json`, `messages/en.json`, and any added catalog.
- Zero technical minor-unit labels or database internals exposed to users (e.g. natural "Kwota" / "Amount").
- Decimal input parsed via BigInt arithmetic according to currency fraction digits, never JavaScript `Number`.
- Accessible names, landmarks, skip links, and ARIA labels localized.
- Parity, decimal parsing, and component tests pass without regressions.

## 9. Data modeling

Do not collapse different financial concepts merely because they share fields.

Examples:

- `Transaction` is not a universal bucket for every planned or actual event.
- `Obligation` remains distinct from actual payment.
- debt liability remains distinct from account balance.
- import source/raw row remains traceable to normalized records.

Prefer explicit domain semantics over clever generic abstractions.

Do not create all future schema tables pre-emptively. Add the smallest schema required by the current phase while preserving planned invariants.

## 10. Database and migrations

PostgreSQL + stable Drizzle is the accepted persistence stack.

Normal schema workflow:

```text
change schema
-> drizzle-kit generate
-> inspect generated SQL
-> test migration
-> commit migration
-> drizzle-kit migrate
```

Rules:

- generated migrations are reviewable source artifacts,
- never use `drizzle-kit push` as the production deployment strategy,
- never hide a destructive migration inside unrelated feature work,
- destructive changes require backup/rollback consideration,
- use database constraints where they truthfully enforce local invariants,
- do not force complex cross-record financial semantics into misleading constraints.

## 11. Imports

Import behavior must be auditable and idempotent where possible.

Preserve provenance such as:

- import batch,
- source type,
- source filename metadata,
- file hash,
- parser version,
- raw row/source record,
- normalized result.

Uncertain matches should be reviewable rather than silently guessed.

Never weaken validation merely to make an import succeed.

## 12. Next.js application rules

The current application stack is Next.js App Router.

Prefer:

- Server Components by default,
- Client Components only for required browser interaction,
- server-owned state where practical,
- URL/search params for shareable navigation/filter state,
- small explicit server operations with validation + authorization.

Do not add a separate backend service, Redux/Zustand, Redis, queues or microservices merely because they are familiar patterns. Introduce them only when a concrete requirement justifies the complexity and record an ADR when material.

Next.js `proxy.ts` is for request routing/locale concerns and coarse checks. It is **not** the sole authorization boundary.

## 13. UX

Optimize the default experience for a non-technical household member.

The user should receive an answer, not an administration console.

Prefer progressive disclosure:

- Home / Summary first,
- deeper transaction/account/debt/import details behind navigation.

Do not expose internal reconciliation or accounting complexity unless the user needs to resolve something.

Do not fabricate sample financial values in production-facing screens merely to make a dashboard look populated. Empty/unknown is a legitimate state.

## 14. Scope discipline

Before implementing a feature, check `ROADMAP.md` and `docs/mvp.md`.

Do not let these block the MVP unless explicitly promoted:

- direct bank sync,
- public cloud hosting,
- OCR,
- mandatory AI,
- Nodvis Recall integration,
- generic sensitive-document uploads before their security ADR,
- durable queues/background infrastructure without demonstrated need.

## 15. Architecture decisions

Material architectural choices require an ADR.

Examples:

- storage architecture,
- encryption/key management,
- backup/restore model,
- background-job model,
- external/public API boundaries,
- strong-auth recovery/enrollment policy,
- changes to the accepted runtime/framework/database/auth topology.

Use the template in `docs/adr/README.md`.

## 16. Code changes

- make small, reviewable changes,
- add tests for changed financial behavior,
- prefer readable code over compressed abstractions,
- update docs when behavior, invariants or architecture change,
- avoid unrelated refactors in feature changes,
- validate untrusted input with the selected boundary-validation approach,
- preserve data rather than fabricating certainty when requirements/source evidence are ambiguous.

Dependency/framework/auth upgrades are maintenance work but still require reading relevant release/security notes when they may alter runtime behavior, schema or security boundaries.
