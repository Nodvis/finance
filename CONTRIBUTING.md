# Contributing to Nodvis Finance

Nodvis Finance is currently a private, pre-implementation project. Contributions should prioritize domain correctness, security and clear product behavior over speed or feature count.

## Before making a change

Read:

- `README.md`
- `AGENTS.md`
- `docs/product.md`
- `docs/domain.md`
- `docs/mvp.md`
- relevant ADRs in `docs/adr/`

## Design-first rule

If a change affects any of the following, document the decision before or with implementation:

- financial semantics,
- authentication,
- storage/encryption,
- deployment,
- import behavior,
- backup/restore,
- cross-product integration,
- external services/AI.

Material architectural decisions require an ADR.

## Financial correctness

Changes must preserve the invariants in `docs/domain.md`.

When implementation begins, behavior affecting transfers, cash, credit cards, obligations, liabilities, reimbursements, imports or forecasts should include tests demonstrating the relevant invariant.

## Security

Never commit:

- credentials or secrets,
- real bank statements,
- real financial documents,
- unredacted personal exports,
- encryption keys.

Use synthetic fixtures.

See `SECURITY.md` for repository security rules.

## Internationalization

Polish and English are supported from the beginning. New user-facing copy must use the project's i18n mechanism once the application scaffold exists.

## Scope

Check `ROADMAP.md` and `docs/mvp.md` before expanding scope. Direct bank sync, mandatory AI, public cloud and Recall integration are intentionally later concerns unless explicitly promoted by a new decision.

## Commit style

Prefer concise Conventional Commit-style messages, for example:

```text
feat: add manual transaction flow
fix: prevent transfer from counting as income
refactor: isolate import normalization
security: harden uploaded file validation
docs: record authentication ADR
test: cover credit card repayment invariant
```

## Pull requests

Keep changes focused and explain:

- what problem is solved,
- what domain/security assumptions are affected,
- which tests validate financial behavior,
- whether documentation or ADRs changed.

Avoid unrelated refactors in the same change.
