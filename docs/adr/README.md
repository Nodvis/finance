# Architecture Decision Records

ADRs capture significant decisions that should remain understandable after implementation details change.

## Status values

Use one of:

- `Proposed`
- `Accepted`
- `Superseded by ADR-XXXX`
- `Rejected`

## Naming

```text
NNNN-short-decision-name.md
```

## Template

```markdown
# ADR-NNNN: Title

- Status: Proposed
- Date: YYYY-MM-DD

## Context

What problem or constraint requires a decision?

## Decision

What are we choosing?

## Consequences

### Positive

- ...

### Negative / trade-offs

- ...

## Alternatives considered

- ...

## Follow-up

- ...
```

## Current ADRs

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-self-hosted-first.md) | Self-hosted first | Accepted |
| [0002](0002-separate-application-boundary.md) | Finance remains isolated from other Nodvis products | Accepted |
| [0003](0003-i18n-from-the-first-commit.md) | PL + EN are architecture-level requirements | Accepted |
| [0004](0004-core-without-mandatory-ai.md) | Core product works without mandatory AI/paid APIs | Accepted |
| [0005](0005-technology-stack.md) | Node 24 + TypeScript + pnpm workspace + Next.js/React | Accepted |
| [0006](0006-persistence-and-money.md) | PostgreSQL + Drizzle + bigint minor-unit money | Accepted |
| [0007](0007-authentication.md) | Better Auth with an isolated Finance auth boundary | Accepted |
| [0008](0008-deployment-topology.md) | Self-hosted modular monolith with web + PostgreSQL | Accepted |

## Decisions intentionally still open

Record dedicated ADRs before implementing or shipping the relevant area:

- sensitive document storage,
- encryption/key management,
- backup/restore format and verification,
- durable background jobs/queues if required,
- public/external API boundaries if a second client is introduced,
- TOTP/passkey enrollment and account recovery policy,
- any future hosted/cloud topology.

Do not create ADRs for routine implementation details that do not materially change architecture, security or domain semantics.
