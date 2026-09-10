# Domain model and financial invariants

> Status: design document. The exact database schema is intentionally not final yet.

This document defines financial meaning that implementation must preserve. Storage shape may change; domain semantics should not drift silently.

## Core concepts

### Household

A financial household context containing people, shared finances, obligations and reporting.

### Person

An individual participant. A person is not interchangeable with a household.

### Account

A place where money or spending capacity is represented.

Planned account types include:

- personal bank account,
- joint account,
- savings account,
- cash wallet,
- household cash,
- credit card,
- potentially prepaid/fintech accounts.

An account may have:

- owner,
- joint owners,
- currency,
- institution,
- starting balance,
- current balance.

Until a transaction ledger exists, the persisted bootstrap/current value is an
optional **balance snapshot**: exact minor units in the account currency plus
the instant at which the balance was observed. It is not presented as a
ledger-calculated balance. Amount and observation time are either both known or
both unknown.

Sign conventions for balance snapshots:

- **Asset accounts (`checking`, `savings`, `cash`)**:
  - `amountMinor > 0`: positive available funds (asset),
  - `amountMinor == 0`: zero balance,
  - `amountMinor < 0`: overdraft / negative balance.
- **Credit-card accounts (`credit_card`)**:
  - `amountMinor < 0`: outstanding debt / statement balance owed to the issuer (e.g. -200.00 PLN = 200 PLN liability),
  - `amountMinor == 0`: zero balance owed,
  - `amountMinor > 0`: overpayment / credit balance.
  - Credit-card limits and capacity do **not** contribute to available cash (preserving INV-013).

### Transaction

An actual financial event. Not every planned event is a transaction.

Required distinctions include:

- expense,
- income,
- transfer,
- reimbursement,
- adjustment,
- debt payment.

### Transfer

Movement of money between accounts controlled by the household/person.

Example:

```text
mBank      -1000
CA Eryk    +1000
```

Financial meaning:

```text
transfer: mBank -> CA Eryk
amount: 1000 PLN
```

It is neither 1000 PLN of spending nor 1000 PLN of income.

### Cash

Cash is modeled as an account/wallet rather than an invisible side channel.

ATM withdrawal:

```text
Bank account -> Cash
500 PLN
```

is a transfer.

A later cash purchase:

```text
Cash -> Merchant
150 PLN
```

is the expense.

Cash must tolerate uncertainty. If the application says 120 PLN but the actual wallet contains 310 PLN, a +190 PLN adjustment with unknown source is valid. Do not fabricate historical provenance.

### Reimbursement

A later repayment/return connected to an earlier expense.

The system should preserve both cash-flow events while allowing analytics to compute the household's net economic cost.

### Obligation

A planned or committed upcoming payment for a household (e.g. utility bills, subscriptions, scheduled insurance, rent).

Key semantics and invariants:
- **Household-scoped**: Belongs to exactly one household.
- **Fields**:
  - `title`: Non-empty description up to 160 characters.
  - `amountMinor`: Positive integer in minor currency units (BigInt). JS `Number` is never used.
  - `currency`: 3-letter ISO code (e.g. `PLN`).
  - `dueDate`: Calendar date string (`YYYY-MM-DD`, stored in Postgres `date` format), timezone-independent.
  - `notes`: Optional string up to 280 characters.
  - `version`: Optimistic concurrency integer starting at 1.
  - `cancelledAt`: Null while active; non-null timestamp when cancelled.
  - `transactionId`: Null while unmatched; points to at most one active canonical expense transaction.
- **Derived status (never persisted)**:
  - `upcoming`: Active (`cancelledAt === null`), unmatched (`transactionId === null`), `dueDate >= today`.
  - `overdue`: Active (`cancelledAt === null`), unmatched (`transactionId === null`), `dueDate < today`.
  - `paid`: Active (`cancelledAt === null`), matched to an active expense (`transactionId !== null`).
  - `cancelled`: Inactive (`cancelledAt !== null`). Cannot be matched.
- **Manual explicit matching**:
  - Requires exact household, active transaction (`voidedAt === null`), kind `expense`, exact currency, and exact `amountMinor`.
  - Mutually exclusive with active liability repayments and active BNPL purchases (one canonical transaction cannot satisfy multiple domain links).
  - Unlink returns the obligation to active status (`upcoming` or `overdue`).
- **Deferred recurrence**:
  - Recurrence is intentionally kept out of persisted semantics in the MVP. Each obligation represents a discrete payment commitment. Automated recurring generation is explicitly deferred.

### Liability

Outstanding debt or financial obligation over time, such as a loan, credit-card debt, installment plan or BNPL balance.

### Loan

A loan needs financial structure beyond a single transaction, for example:

- remaining principal,
- interest rate,
- installment amount,
- due date,
- schedule,
- owner.

A 623 PLN payment may represent:

```text
500 PLN principal reduction
123 PLN financing cost / interest
```

Cash flow is -623 PLN, but only 123 PLN is financing expense while 500 PLN reduces liability.

### Credit card

A purchase made with a credit card is the actual expense.

Example:

```text
Lidl: 200 PLN
```

Later card repayment:

```text
Bank account -> Credit card
200 PLN
```

must not count the Lidl purchase a second time.

### Installment plan

For an item bought in installments, preserve three different values:

1. purchase value,
2. monthly cash-flow requirement,
3. remaining liability.

They are not interchangeable.

### BNPL

Pay-later obligations such as Allegro Zapłać Później should contribute to:

- debt outstanding,
- upcoming obligations,
- forecast.

### ImportBatch / ImportRow

Imports need provenance and auditability.

A planned import batch should preserve enough context to answer where a normalized transaction came from, including concepts such as:

- source,
- filename metadata,
- file hash (e.g. SHA-256),
- target account,
- parser version,
- imported timestamp,
- raw rows/source records.

## Ownership and context

Do not collapse all ownership semantics into one `owner` field.

A transaction can independently express contexts such as:

```text
account:     mBank joint
paid by:     Karolina
applies to:  household
category:    groceries
```

Account ownership, payer, beneficiary and household/person reporting context are separate concepts.

## Financial views

The product maintains distinct views:

### Available cash

What can be spent now.

### Debt outstanding

What remains owed.

### Upcoming obligations

What must likely be paid soon.

### Cash flow

Actual inflows and outflows.

### Net worth

Optional analytical view. It must not replace the other metrics or dominate the home experience.

## Mandatory invariants

These invariants must be covered by domain-level tests once implementation starts.

### INV-001 — Transfer is not income or expense

Moving money between owned accounts must not increase reported household income or spending.

### INV-002 — ATM withdrawal is a transfer to cash

Withdrawal from a bank account into a household cash wallet is not itself spending.

### INV-003 — Credit-card purchase is an expense

A purchase performed on credit creates the spending event when the purchase occurs.

### INV-004 — Credit-card repayment is not a second expense

Repayment settles/moves money against card liability and must not duplicate the original purchase in spending analytics.

### INV-005 — Obligation does not change actual balance

Expected/planned payments affect forecast and upcoming views only until an actual payment occurs.

### INV-006 — Real payment may settle an obligation

Actual payment can be reconciled with an existing obligation rather than creating an unrelated duplicate concept.

### INV-007 — Import must not blindly duplicate existing data

An imported statement overlapping with earlier imports or manual entries must go through deterministic identity/deduplication/matching logic.

### INV-008 — Loan principal reduction is not interest expense

Principal reduction lowers liability; interest represents financing cost. The complete payment remains relevant to cash flow.

### INV-009 — Unknown cash source is valid

The model must permit balance adjustments or unknown provenance rather than requiring invented history.

### INV-010 — Reimbursement may offset earlier expense

The system must preserve actual cash movements and still support net-cost analysis.

### INV-011 — Household and Person are distinct

Reporting and ownership logic must not treat these as aliases.

### INV-012 — Account ownership differs from transaction context

Who owns an account is independent from who paid, who benefited or whether an expense applies to the household.

### INV-013 — Debt outstanding and available cash are separate metrics

Do not reduce them to a single main-screen balance such as `cash - total debt`.

### INV-014 — Forecast communicates uncertainty

Estimated future values must not be represented as guaranteed actual balances.

### INV-015 — Obligations are pure planning metadata with mutually exclusive transaction matching

Obligations never alter ledger balances, snapshots, cash flow reporting, or available cash. An obligation is satisfied solely by explicit manual matching with an active canonical expense transaction of identical currency and minor amount. A canonical transaction cannot be simultaneously linked to an active obligation, active liability repayment, or active BNPL purchase.

## Reconciliation

Reconciliation should connect representations of the same real-world event rather than duplicate them.

Examples include matching:

- obligation -> imported payment,
- manual transaction -> imported transaction,
- opposite account movements -> transfer,
- payment confirmation -> transaction,
- reimbursement -> earlier expense.

Uncertain matches should be suggested for review rather than silently merged.

## Dedupe signals

Potential signals include:

- bank transaction ID,
- amount,
- date/time or close date range,
- payee/description,
- source account,
- known owned-account counterpart,
- existing manual record,
- import batch/source identifiers.

Exact algorithms are not decided yet.

## Candidate entities — not final schema

The product specification currently suggests concepts such as:

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

Do **not** create one database table for every name by default. Granularity and invariants must be designed before final persistence schema.
