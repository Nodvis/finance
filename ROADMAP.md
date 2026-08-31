# Nodvis Finance Roadmap

This roadmap describes product maturity, not release dates. Security and domain correctness take precedence over feature count.

## Phase 0 — Product, domain and security design **(current)**

Goal: remove the highest-risk ambiguities before implementation.

### Research

- Review Actual Budget, Firefly III, Sure/Securo, YNAB and debt-payoff applications.
- Review Polish household-finance tools.
- Compare statement-import and import-review UX patterns.
- Compare budgeting, stabilization and debt-repayment strategies.

### Domain design

Finalize semantics and invariants for:

- household and person,
- account and cash,
- transaction,
- transfer,
- reimbursement,
- adjustment,
- obligation,
- liability,
- loan,
- credit card,
- installment plan,
- BNPL,
- forecast.

### Security design

- Complete the threat model.
- Decide authentication architecture in an ADR.
- Decide sensitive-file storage and encryption strategy.
- Define backup, restore and verification expectations.
- Define safe upload/document handling.

### UX design

Design the core flows first:

- Home / Summary,
- Add data,
- Accounts,
- Debts,
- Upcoming,
- Import review.

### Foundation decisions

- PL + EN and locale-aware formatting are mandatory.
- Choose the implementation stack in an ADR.
- Define repository/application structure only after the stack decision.

### Exit criteria

Phase 0 is complete when:

- core financial invariants are explicit and testable,
- the MVP boundary is stable,
- primary UX flows are specified,
- initial threat model is reviewed,
- auth/storage/stack decisions have ADRs,
- no known architectural decision can silently corrupt financial meaning.

---

## Phase 1 — Foundation + real money model

Goal: correctly represent money that exists now.

Planned scope:

- Household,
- users/persons,
- PL/EN foundation,
- accounts,
- balances,
- cash accounts,
- categories,
- manual transactions,
- transfers,
- basic dashboard.

Not in scope yet: advanced analytics or complex planning.

### Exit criteria

A household can manually represent its real accounts, cash, transactions and transfers without double-counting money movement.

---

## Phase 2 — Import

Goal: make real-world data entry practical.

Planned scope:

- Credit Agricole adapter,
- PKO BP adapter,
- mBank adapter,
- Revolut adapter,
- generic CSV,
- import batches and raw rows,
- deterministic deduplication,
- transfer matching,
- categorization rules,
- import review screen,
- audit trail from normalized record back to source import.

### Exit criteria

Importing the same or overlapping statements does not blindly duplicate transactions, and the user can review uncertain matches before committing them.

---

## Phase 3 — Debt and obligations

Goal: answer **how much do we owe and what must we pay?**

Planned scope:

- loans,
- credit cards,
- installments,
- BNPL,
- recurring obligations,
- due dates,
- payment matching,
- upcoming screen.

### Exit criteria

The application can distinguish debt outstanding from available cash and can show upcoming required payments without modifying actual balances until payment happens.

---

## Phase 4 — Planning

Goal: turn historical data into realistic decisions.

Planned scope:

- month status,
- 30/60/90-day forecast,
- stabilization strategy,
- 50/30/20 benchmark,
- sinking funds,
- savings goals,
- debt avalanche,
- debt snowball,
- custom scenarios,
- confidence-aware conservative/base/optimistic forecasts.

### Exit criteria

The user can compare realistic scenarios without the application presenting uncertain future values as guaranteed facts.

---

## Phase 5 — Documents

Goal: connect relevant evidence and agreements to financial records.

Planned scope:

- secure upload,
- attachments,
- document inbox,
- contracts,
- schedules,
- statements,
- receipts,
- invoices,
- payment confirmations.

Document storage must not ship before its security architecture is ready.

---

## Later / optional

These are explicitly non-blocking for the MVP:

- OCR,
- local AI assistance,
- optional external AI integrations,
- direct bank sync,
- hosted public cloud,
- optional integration with Nodvis Recall.

## Roadmap rule

A feature should not advance to implementation merely because it is technically interesting. It should either improve one of the product's core answers or reduce friction in obtaining trustworthy financial data.
