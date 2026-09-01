# Nodvis Finance Roadmap

This roadmap describes product maturity, not release dates. Security and domain correctness take precedence over feature count.

## Phase 0 — Product, domain and security design **(current)**

Goal: remove the highest-risk ambiguities before broad product implementation.

### Foundation already established

- [x] Repository/documentation foundation.
- [x] Explicit core financial invariants.
- [x] Initial MVP boundary.
- [x] Initial threat model.
- [x] Self-hosted-first ADR.
- [x] Separate Finance application/data/auth boundary ADR.
- [x] PL + EN foundation ADR.
- [x] Core-without-mandatory-AI ADR.
- [x] Technology stack ADR.
- [x] PostgreSQL/Drizzle and exact-money ADR.
- [x] Better Auth direction ADR.
- [x] Initial modular-monolith deployment ADR.
- [x] Initial `apps/web + packages/domain + packages/db` scaffold.
- [x] First exact `Money` domain primitive and tests.
- [x] Initial `/pl` and `/en` application shell.
- [x] CI definition for typecheck/tests/build/E2E.

### Research still required

- [ ] Review Actual Budget, Firefly III, Sure/Securo, YNAB and debt-payoff applications.
- [ ] Review Polish household-finance tools.
- [ ] Compare statement-import and import-review UX patterns.
- [ ] Compare budgeting, stabilization and debt-repayment strategies.

Research should challenge the current design where evidence warrants it; it should not turn the product into a clone.

### Domain design still required

Finalize detailed semantics and invariants for:

- [ ] household and person,
- [ ] account and cash,
- [ ] transaction,
- [ ] transfer,
- [ ] reimbursement,
- [ ] adjustment,
- [ ] obligation,
- [ ] liability,
- [ ] loan,
- [ ] credit card,
- [ ] installment plan,
- [ ] BNPL,
- [ ] forecast.

The existing invariants are binding constraints, but the final persistence shape for these concepts is intentionally not pre-created.

### Security design still required

- [ ] Review/refine the initial threat model against the implemented stack.
- [ ] Define backup, restore and verification expectations before production readiness.
- [ ] Design account-recovery policy before recovery features ship.
- [ ] Design TOTP/passkey enrollment/recovery before stronger-auth features ship.
- [ ] Decide sensitive-file storage, encryption/key management and malicious-file handling **before Phase 5 document upload ships**.

Sensitive document infrastructure is intentionally not a blocker for implementing Phase 1 money/account functionality because production document upload is not yet in scope.

### UX design still required

Design/refine the core flows before each becomes feature work:

- [ ] Home / Summary,
- [ ] Add data,
- [ ] Accounts,
- [ ] Debts,
- [ ] Upcoming,
- [ ] Import review.

The current home page is only a localized scaffold, not a final product design.

### Phase 0 exit criteria

Phase 0 is complete when:

- the Phase 1 financial concepts are sufficiently explicit and testable,
- the MVP boundary is stable,
- the primary Phase 1 UX flows are specified,
- the initial threat model has been reviewed against the chosen stack,
- there is no known unresolved architectural decision that can silently corrupt Phase 1 financial meaning or expose Phase 1 data,
- intentionally deferred areas such as document storage have a clear gate preventing accidental implementation before their security ADRs.

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

Foundation already started:

- workspace/application skeleton,
- exact `Money` primitive and core foundation domain types,
- Person, Household, membership, Account and ownership persistence,
- optional exact balance snapshots with explicit observation time,
- PostgreSQL/Drizzle schema and first reviewed migration,
- Better Auth email/password persistence and server-side session boundary,
- household authorization boundary through explicit auth-user-to-Person links,
- PL/EN routing and messages,
- empty-state dashboard shell,
- selected and integrated auth library.

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

Document storage must not ship before its storage/encryption/access-control/malicious-file/backup architecture is accepted.

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
