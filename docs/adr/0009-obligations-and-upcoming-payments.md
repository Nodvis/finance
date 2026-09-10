# ADR-0009: Obligations and upcoming payments architecture

- Status: Accepted
- Date: 2026-09-10

## Context

Households need visibility into committed future expenses (such as rent, utility bills, subscriptions, insurance, and taxes) before they execute. However, naive implementations of upcoming payments often corrupt financial truth by either:
1. Treating future obligations as executed ledger entries (artificially reducing available cash before money moves), or
2. Creating duplicate expenses upon payment reconciliation (counting the obligation and the imported bank transaction twice), or
3. Allowing concurrent races between repayment/BNPL links and obligation links on canonical transactions.

A coherent architecture is needed that provides clear upcoming payment tracking while preserving core financial invariants.

## Decision

### 1. Pure Planning Metadata (Zero Balance and Reporting Effect)
Obligations (`finance.obligations`) belong strictly to a single household and represent planning metadata only. They have zero effect on ledger balances, account snapshots, cash flow calculations, or available cash.

### 2. Exact Money and Timezone-Independent Calendar Dates
- Monetary amounts are stored as exact positive minor units (`amount_minor bigint CHECK (amount_minor > 0)`), paired with an explicit ISO-4217 currency code. Floating-point numbers are never used.
- Due dates are stored as PostgreSQL calendar dates (`date` mode string `YYYY-MM-DD`). Comparisons against a reference date are lexicographical and calendar-exact, preventing timezone-induced day shifts.

### 3. Derived Lifecycle Status (Not Persisted)
Status is computed dynamically at the domain/query boundary to eliminate stale status drift:
- `upcoming`: Active (`cancelled_at IS NULL`), unmatched (`transaction_id IS NULL`), and `due_date >= today`.
- `overdue`: Active (`cancelled_at IS NULL`), unmatched (`transaction_id IS NULL`), and `due_date < today`.
- `paid`: Active (`cancelled_at IS NULL`) with a matched active canonical expense transaction (`transaction_id IS NOT NULL`).
- `cancelled`: Inactive (`cancelled_at IS NOT NULL`). Cancelled obligations cannot be matched or updated.

Persisting a static `status` column was rejected because it would require background cron workers to transition `upcoming` to `overdue` at midnight across timezones.

### 4. Manual, Explicit Matching (No Fuzzy/Automatic Linking)
Matching an obligation to an expense transaction must always be an explicit user action:
- Eligible candidates must belong to the same household, be active (`voided_at IS NULL`), have kind `expense`, match the exact currency, and match the exact minor unit amount.
- An obligation matches at most one canonical transaction.
- Once matched, the obligation transitions to `paid`.
- The user can explicitly unlink a paid obligation, safely returning it to active (`upcoming` or `overdue`) status.

### 5. Canonical Transaction Exclusivity and Immutability Safeguards
A canonical transaction may serve at most one domain attachment:
- A transaction cannot be simultaneously linked to an active obligation, an active liability repayment, or an active BNPL purchase.
- This is enforced both via partial unique indices (`obligations_active_transaction_unique`) and via explicit pre-checks in transactional DB access methods (`recordLiabilityRepaymentInDb`, `validatePurchaseTransaction`, `matchObligationInDb`).
- A matched transaction's amount, currency, or kind cannot be modified, and the transaction cannot be voided, until it is explicitly unlinked from the obligation.
- A matched obligation's amount or currency cannot be modified until unlinked.

### 6. Strict Concurrency Control via Household Serialization
All obligation state mutations (create, update, cancel, match, unlink) and transaction modifications acquire the household row lock:
```sql
SELECT id FROM households WHERE id = $1 FOR UPDATE
```
This guarantees serialization and eliminates TOCTOU race conditions when multiple members or background imports interact concurrently.

### 7. Deferred Recurrence Semantics
In this MVP, recurring obligations (e.g. monthly subscriptions) are tracked as discrete obligation instances. Automated rule generation and recurring obligation templates are explicitly deferred to avoid premature schema coupling with statistical recurring pattern recognition.

## Consequences

### Positive
- Strict preservation of financial invariants (INV-013, INV-014, INV-015): no double-counting, no fabricated money movements.
- Reliable state transitions without background scheduler dependencies.
- Strong referential and boundary integrity across liabilities, BNPL, and obligations.
- Zero raw database identifiers exposed in the user interface.

### Trade-offs & Limitations
- If a bill's actual paid amount differs slightly from its estimated amount, the obligation cannot be matched directly; the user must update the obligation's amount to match the expense before linking, or create a new obligation.
- Recurring bills must be created individually per period until recurring templates are introduced.
