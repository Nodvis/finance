# ADR-0005: Application technology stack

- Status: Accepted
- Date: 2026-08-31

## Context

Nodvis Finance is a privacy-sensitive, self-hosted household finance application that will initially be developed by a very small team with heavy assistance from coding agents.

The stack must optimize for:

- correctness and maintainability over novelty,
- excellent TypeScript/agent tooling,
- simple self-hosted deployment,
- server-side security boundaries,
- first-class PL/EN internationalization,
- a responsive web UI suitable for non-technical users,
- the ability to add a mobile client or explicit API later without rewriting the financial domain,
- low operational cost.

The documented domain invariants must remain independent from the web framework and persistence details.

## Decision

### Runtime and language

Use:

- **Node.js 24 LTS** as the supported production/runtime baseline,
- **TypeScript 7.x** in strict mode,
- ESM-first packages.

Production should track supported Node 24 security/minor releases rather than floating to Node Current.

### Repository/workspace

Use a **pnpm workspace** with a small monorepo layout.

Initial boundaries:

```text
apps/
  web/
packages/
  domain/
  db/
```

Do **not** add Turborepo/Nx initially. pnpm workspaces are sufficient until build orchestration proves necessary.

The purpose of the workspace split is architectural, not organizational ceremony:

- `apps/web` owns the web application and transport/UI concerns,
- `packages/domain` owns deterministic financial concepts and calculations,
- `packages/db` owns PostgreSQL access, schema and migrations.

Future clients such as `apps/mobile` can consume domain/API contracts without moving domain logic out of a framework-bound application later.

### Web application

Use **Next.js 16 Active LTS**, App Router, with **React 19.2**.

Architecture defaults:

- Server Components by default,
- Client Components only where browser interaction requires them,
- Route Handlers and Server Actions for the internal web application where appropriate,
- authorization must still be verified inside every privileged server operation,
- no separate backend service for the MVP,
- no Edge-runtime dependency.

Next.js `proxy.ts` may be used for locale negotiation and coarse request routing, but never as the sole authorization boundary.

### Internationalization

Use **next-intl 4.x** from the first application scaffold.

Initial locales:

- `pl`
- `en`

The application must use locale-aware formatting for user-visible dates, numbers and currencies. User-facing strings belong in translation messages rather than being scattered through components.

### UI

Use:

- **Tailwind CSS 4.x**,
- **shadcn/ui patterns/components selectively**, committed into the repository rather than treated as an opaque runtime design system,
- accessible primitives and semantic HTML.

Avoid introducing a second styling system.

### Validation

Use **Zod 4.x** at untrusted boundaries such as:

- environment/config parsing,
- forms and Server Actions,
- Route Handler input,
- import adapter output before normalization,
- external integration payloads.

Zod validation does not replace domain invariants or database constraints.

### Client state

Do not add Redux, Zustand or another global client-state library initially.

Prefer:

- server-owned state,
- URL/search params where appropriate,
- React local state for ephemeral UI state.

Introduce a global client-state library only through a concrete need.

### Tests

Use:

- **Vitest 4.x** for unit/integration tests,
- **Playwright 1.62.x** for end-to-end browser tests.

Financial domain tests have priority over cosmetic UI coverage.

Property-based testing may be added for high-value financial invariants where it materially increases confidence.

## Consequences

### Positive

- One primary language across web, domain and persistence boundaries.
- Strong ecosystem and coding-agent support.
- Domain logic can remain framework-independent.
- Simple initial deployment: one application process plus PostgreSQL.
- PL/EN support is built in rather than retrofitted.
- A future mobile client does not require moving core financial math out of Next.js because that logic already lives in `packages/domain`.

### Negative / trade-offs

- Next.js is a large framework and requires disciplined security patching.
- A workspace has slightly more setup than a single-package repository.
- Server Actions can become implicit RPC if used carelessly; privileged operations still require explicit validation and authorization.
- The application is intentionally coupled to the Node.js ecosystem for the first implementation.

## Alternatives considered

### Separate React frontend + NestJS/Fastify API

Rejected for MVP because it creates two deployable application services and duplicated transport/auth complexity before a second client exists.

### TanStack Start

Attractive TypeScript-first option, but Next.js currently provides a more mature ecosystem for the selected i18n/auth/UI stack and broader coding-agent familiarity.

### Single-package Next.js repository

Simpler initially, but rejected because keeping financial domain logic framework-independent is valuable enough to justify a minimal workspace boundary.

### Turborepo/Nx

Not needed yet. May be introduced later if build orchestration, caching or additional applications justify it.

## Security maintenance rule

Framework/runtime patch releases are security maintenance, not optional feature upgrades.

In particular:

- stay on a supported Node.js LTS line,
- apply supported Next.js security patches promptly,
- do not pin to known-vulnerable framework versions for reproducibility.

## Follow-up

- ADR-0006: persistence and money representation.
- ADR-0007: authentication.
- ADR-0008: deployment topology.
- Create the initial pnpm workspace and application skeleton.
