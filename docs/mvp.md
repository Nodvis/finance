# MVP scope

## MVP objective

The first useful Nodvis Finance release should make a household's financial position understandable without requiring accounting expertise.

The MVP is not defined by a large feature list. It is defined by whether the application can answer the core financial questions reliably.

## MVP must eventually support

### Household and people

- one household,
- multiple people/users,
- distinction between household context and person context,
- account ownership that can differ from transaction payer/beneficiary context.

### Accounts and cash

- personal bank account,
- joint bank account,
- savings account,
- cash wallet / household cash,
- starting and current balances,
- institution and currency metadata,
- transfers between owned accounts.

### Transactions

At minimum distinguish:

- expense,
- income,
- transfer,
- reimbursement,
- adjustment,
- debt payment.

The model must prevent common double-counting errors.

### Import

- Credit Agricole,
- PKO BP,
- mBank,
- Revolut,
- generic CSV,
- import batch provenance,
- deduplication,
- probable transfer matching,
- user review for uncertain cases,
- rules-based categorization.

### Debt and obligations

- loans,
- credit cards,
- installments,
- BNPL/pay-later,
- recurring obligations,
- due dates,
- expected vs paid status,
- matching actual payments to obligations.

### Dashboard

The default summary should prioritize:

- available money,
- upcoming payments,
- debt outstanding,
- current-month income/spending/obligations,
- a simple month status.

### Basic planning

The MVP planning experience should eventually support enough forecasting to answer whether the current month is likely to work and show realistic next-step scenarios.

## Foundation requirements

These are not optional polish:

- PL + EN architecture,
- locale-aware dates/numbers/currency,
- secure authentication design,
- self-hosted deployment,
- backup/restore plan,
- privacy-preserving defaults,
- tests for financial invariants.

## Explicit non-goals for the initial MVP

The following should not delay the first useful release:

- public hosted cloud,
- direct bank credential login/sync,
- mandatory AI,
- paid AI dependency,
- advanced OCR,
- Nodvis Recall integration,
- shared cross-product database,
- large numbers of charts,
- exhaustive support for every bank/import format.

## Scope test

Before adding an MVP feature, ask:

1. Does it materially help answer one of the core household-finance questions?
2. Does it reduce manual effort needed to get trustworthy data into the system?
3. Does it protect the correctness, security or recoverability of sensitive data?

If all three answers are no, the feature probably belongs after MVP.

## Completion test

A user with real-world household finances should be able to provide/import the relevant data and then quickly determine:

- available cash,
- total outstanding debt,
- near-term required payments,
- current spending level and categories,
- whether the month is financially safe,
- a realistic improvement plan.

The answers must remain correct in the presence of internal transfers, cash withdrawals, credit-card repayment and planned-but-not-yet-paid obligations.
