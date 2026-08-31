# ADR-0004: Core product without mandatory AI

- Status: Accepted
- Date: 2026-08-31

## Context

Nodvis Finance may eventually benefit from AI for OCR, document extraction or classification. However, the core financial model is deterministic and highly sensitive. Making external AI a required dependency would increase cost, privacy exposure, operational complexity and failure modes without being necessary for the main product value.

## Decision

The core product must function without AI and without paid external APIs.

Prefer deterministic implementations for:

- import parsing,
- normalization,
- transaction matching,
- deduplication,
- transfer detection,
- categorization rules,
- forecasting math,
- debt payoff simulations.

Future AI capabilities must be optional. External AI processing of financial data must be explicit opt-in.

## Consequences

### Positive

- core features remain private and self-contained,
- predictable behavior is easier to test and audit,
- no required per-request AI cost,
- self-hosted deployments can work without external API credentials,
- critical financial logic does not depend on probabilistic model output.

### Negative / trade-offs

- some document extraction/classification may require more deterministic engineering,
- optional AI features need a clean boundary rather than being embedded throughout core logic.

## Alternatives considered

### AI-first classification/import pipeline

Rejected as the default because transaction categorization and many matching tasks can be solved effectively with rules and deterministic logic.

### Mandatory hosted AI service

Rejected because it conflicts with the self-hosted/privacy direction and creates an unnecessary core dependency.

## Follow-up

If AI is introduced later, create a dedicated ADR covering:

- local vs external models,
- exact data sent,
- opt-in UX,
- retention/privacy implications,
- failure/fallback behavior,
- whether AI output is advisory or authoritative.
