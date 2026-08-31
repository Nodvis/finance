# AGENTS.md — Nodvis Finance

This file defines repository-wide instructions for AI coding agents and automated contributors.

## 1. Read before changing code

Before implementing product behavior, read:

1. `README.md`
2. `docs/product.md`
3. `docs/domain.md`
4. `docs/mvp.md`
5. `docs/threat-model.md`
6. relevant ADRs in `docs/adr/`

If implementation convenience conflicts with a documented financial invariant, **the invariant wins**. Change the invariant only through an explicit design decision, not silently in code.

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

## 4. Security and privacy

Financial data is highly sensitive.

Never:

- add real statements or personal financial exports to fixtures,
- commit secrets or credentials,
- log sensitive raw documents unnecessarily,
- send complete financial data to external AI/telemetry services by default,
- invent custom cryptography without an approved design,
- expose an insecure public HTTP deployment as the recommended setup.

External AI, analytics, crash reporting and telemetry must default to off for self-hosted installations unless a future ADR changes that policy.

## 5. AI policy

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

## 6. Internationalization

Polish and English are foundation requirements.

Do not introduce user-facing hardcoded strings outside the chosen i18n mechanism once the application scaffold exists.

All user-visible handling of:

- dates,
- numbers,
- currency,
- decimal separators,
- language strings

must be locale-aware.

## 7. Data modeling

Do not collapse different financial concepts merely because they share fields.

Examples:

- `Transaction` is not a universal bucket for every planned or actual event.
- `Obligation` must remain distinct from actual payment.
- debt liability must remain distinct from account balance.
- import source/raw row should remain traceable to normalized records.

Prefer explicit domain semantics over clever generic abstractions.

## 8. Imports

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

## 9. UX

Optimize the default experience for a non-technical household member.

The user should receive an answer, not an administration console.

Prefer progressive disclosure:

- Home / Summary first,
- deeper transaction/account/debt/import details behind navigation.

Do not expose internal reconciliation or accounting complexity unless the user needs to resolve something.

## 10. Scope discipline

Before implementing a feature, check `ROADMAP.md` and `docs/mvp.md`.

Do not let these block the MVP unless explicitly promoted:

- direct bank sync,
- public cloud hosting,
- OCR,
- mandatory AI,
- Nodvis Recall integration.

## 11. Architecture decisions

Material architectural choices require an ADR.

Examples:

- technology stack,
- database,
- auth library/provider,
- storage architecture,
- encryption/key management,
- deployment architecture,
- background-job model,
- API boundaries.

Use the template in `docs/adr/README.md`.

## 12. Code changes

Once implementation begins:

- make small, reviewable changes,
- add tests for changed financial behavior,
- prefer readable code over compressed abstractions,
- update docs when behavior or invariants change,
- avoid unrelated refactors in feature changes,
- never weaken validation merely to make an import succeed.

If requirements are ambiguous, preserve data rather than fabricating certainty and document the unresolved decision.
