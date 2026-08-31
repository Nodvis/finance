# Product planning snapshot — 2026-08-31

> Historical reference. This repository document is a normalized snapshot of the planning specification used to initialize `Nodvis/finance`. Maintained design documents in `docs/` and accepted ADRs are the current source of truth.

## Original state

- Date: 2026-08-31
- Stage: product planning / before implementation
- Priority: highest among the current Nodvis projects
- Working names in the source document: Nodvis Finance / Nodvis Balance
- Repository/product name selected afterwards: **Nodvis Finance**

## Product objective

A private, self-hosted household-finance control center designed to answer:

> What is our actual financial situation, what must we pay, how much do we owe, how much is available, and what plan can safely improve the situation?

It should not simply clone Actual Budget, Firefly III, YNAB or an accounting spreadsheet.

## First real use case

A two-person household with a mix of:

- separate bank accounts,
- joint account,
- Revolut/other accounts,
- cash,
- loans,
- credit cards,
- installments,
- BNPL/pay-later,
- different repayment schedules,
- transfers between owned accounts,
- shared and personal spending.

Initial financial data may come from Credit Agricole, PKO BP, mBank and Revolut, with other institutions later.

Direct bank integration is not assumed.

## UX principle

The backend may reconcile, classify, forecast, deduplicate and calculate scenarios, but the ordinary user should not need to understand that complexity.

Core principle:

> **The user should receive an answer, not a system to administer.**

The Home/Summary view should quickly answer:

- how much is available now,
- how much must be paid,
- whether funds should last until next income,
- how much debt remains,
- how much debt was reduced,
- where spending is too high,
- what can be done this month.

## PL + EN from the beginning

Foundation requirement:

- `pl`,
- `en`,
- locale-aware dates,
- locale-aware numbers,
- currency formatting,
- translation keys,
- no scattered hardcoded UI strings.

Polish is the first real usage language; English must be architecturally supported from the start.

## Self-host first

The first version is self-hosted only because financial data is sensitive and initial usage is private.

No bank usernames, bank passwords or PINs should be stored.

## Core financial separation

The product must maintain separate views of:

- available cash,
- debt outstanding,
- upcoming obligations,
- cash flow,
- optional net worth.

A household with 3,000 PLN on accounts and 50,000 PLN debt should not receive `-47,000 PLN` as the main answer to whether it can pay near-term bills.

## Domain distinctions

### Transaction types

Distinguish at least:

- expense,
- income,
- transfer,
- refund/reimbursement,
- adjustment,
- debt payment.

### Transfers

Moving 1,000 PLN from one owned account to another is a transfer, not 1,000 PLN expense plus 1,000 PLN income.

### ATM withdrawal

Bank account -> cash is a transfer. The later cash purchase is the expense.

### Cash uncertainty

Unknown source/provenance is a valid state. The system should store uncertainty instead of inventing a false historical explanation.

### Reimbursements

Preserve the original expense and later reimbursement as cash-flow events while allowing net household cost analysis.

### Credit cards

Credit-card purchase is the expense. Later card repayment is not another expense.

### Loans

A repayment can contain both principal reduction and interest cost. Cash flow and economic meaning must both be representable.

### Installments

Purchase value, monthly cash-flow requirement and remaining liability are different values.

### BNPL

Pay-later balances belong in debt, upcoming obligations and forecasts.

### Obligations

A planned payment is not an executed transaction. It affects forecast but must not change actual account balance until the real payment occurs.

## Reconciliation and import

The system should reconcile planned obligations, imported transactions, manual transactions, transfers and payment confirmations instead of duplicating the same event from different sources.

Initial import targets:

- Credit Agricole,
- PKO BP,
- mBank,
- Revolut,
- generic CSV.

Later formats may include CAMT.053, OFX/QFX, QIF and MT940.

Import batches should retain provenance such as source, filename metadata, SHA-256, account, parser version, import time and raw rows/source records.

Deduplication should consider source transaction IDs, amounts, close dates, payee/description, owned-account transfer pairs and existing manual entries.

## Rules before AI

Simple categorization should use a rules engine where possible, e.g. merchant -> category.

Core product requirement:

> **The product must work without AI and without paid APIs.**

AI may later assist with OCR, extraction and classification. Complete financial statements should not be sent to external LLMs by default.

## Documents

Important records may have attachments such as receipts, invoices, payment confirmations, contracts, loan schedules or statements.

A simple document inbox should allow adding a document before its final association is known.

## Dashboard

The dashboard should prioritize:

- Available,
- To pay (e.g. 7/30 days),
- Debt and trend,
- Current month income/spending/obligations,
- concise month status.

## Progressive disclosure

Primary:

- Summary,
- Plan,
- Upcoming.

Deeper navigation:

- Transactions,
- Accounts,
- Debts & installments,
- Budget,
- Documents,
- Analytics,
- Import,
- Settings.

Budgeting is a module. Product center:

> **financial situation + forecast + obligations + debt**

## Planning approaches

The source specification calls for multiple strategies rather than one mandatory method:

- stabilization mode,
- 50/30/20 benchmark,
- Pay Yourself First,
- Debt Avalanche,
- Debt Snowball,
- sinking funds,
- staged emergency/safety buffer,
- custom scenarios.

Forecasts should support uncertainty rather than presenting one number as certain truth.

## Security direction

Security is part of the MVP.

Finance is separate from Recall:

- separate repo,
- separate database,
- separate secrets,
- separate auth deployment/instance,
- no shared database.

Preferred access:

- LAN,
- VPN,
- Tailscale,
- reverse proxy + TLS.

Authentication must avoid custom password cryptography and should address secure sessions, cookies where applicable, CSRF, rate limiting and future TOTP/passkeys.

Never commit real credentials, production secrets or real statement files.

Encryption requires a deliberate key-management design including backup encryption, key separation, rotation and consequences of key loss.

Privacy-preserving self-host defaults:

```text
analytics: off
telemetry: off
external crash reporting: off
external AI: off
```

Backup must cover:

```text
backup
restore
verify
```

## Candidate domain concepts

Not a final schema:

```text
Household
Person
Account
PaymentInstrument
Transaction
Transfer
Category
Rule
Obligation
Liability
LiabilityPayment
InstallmentPlan
SavingsGoal
SinkingFund
BudgetPlan
ForecastScenario
Document
Attachment
ImportBatch
ImportRow
```

The source explicitly warns against creating every table immediately before granularity and invariants are designed.

## Original key invariants

1. Transfer is not income or expense.
2. ATM withdrawal is a transfer to cash.
3. Credit-card purchase is an expense.
4. Credit-card payoff is not a second expense.
5. Obligation does not change actual balance.
6. Real payment may close an obligation.
7. Import must not blindly duplicate a manual transaction.
8. Loan principal reduction is not interest expense.
9. Unknown cash source is allowed.
10. Reimbursement may compensate an earlier expense.
11. Household and Person are different concepts.
12. Account owner and transaction beneficiary/payer are different concepts.
13. Debt outstanding and available cash are not one balance.
14. Forecast is an estimate and should indicate uncertainty.

## Original phase plan

### Phase 0 — Product/domain/security design

Research competitors and budgeting strategies; finalize domain semantics, threat model, UX flows and PL/EN foundation.

### Phase 1 — Foundation + real money model

Household, users, PL/EN, accounts, balances, cash, categories, manual transactions, transfers and basic dashboard.

### Phase 2 — Import

Bank adapters, generic CSV, ImportBatch, deduplication, transfer matching, rules and review screen.

### Phase 3 — Debt and obligations

Loans, credit cards, installments, BNPL, recurring obligations, due dates, payment matching and upcoming screen.

### Phase 4 — Planning

Month status, 30/60/90 forecasts, stabilization, 50/30/20 benchmark, sinking funds, savings goals, avalanche/snowball and custom scenarios.

### Phase 5 — Documents

Secure uploads, attachments, document inbox, contracts, schedules, statements, receipts, invoices and confirmations.

### Much later / optional

- OCR,
- local AI,
- bank sync,
- public cloud,
- Recall integration.

## MVP success definition

After importing data and entering obligations, the user should be able to answer in under one minute:

- How much money do we have?
- How much do we owe?
- What must we pay soon?
- How much do we really spend?
- On what?
- Does the current month work?
- What is the safest plan for improving the situation?

The source explicitly rejects feature/chart count as the definition of MVP success.
