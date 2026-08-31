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

Example:

```text
0005-technology-stack.md
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

## Next ADRs expected

These decisions are intentionally still open:

- technology stack,
- database/persistence approach,
- authentication,
- deployment topology,
- document storage,
- encryption/key management,
- backup/restore model.
