# ADR-0010: Deterministic recurring obligation materialization

- Status: Accepted
- Date: 2026-09-10

## Context

Households need predictable upcoming payments without creating ledger transactions or an unbounded number of planning rows. Recurrence must remain compatible with ordinary obligation matching, history and cash forecast.

## Decision

Persist a household-owned recurring definition separately from ordinary obligations. Materialize ordinary obligation occurrences on create, edit and read paths that need upcoming/forecast data, bounded to today through 90 calendar days. Each occurrence is identified by `(recurring_definition_id, due_date)` with a partial unique index, so repeated or concurrent materialization is idempotent.

The MVP supports weekly, monthly and yearly frequencies. Dates are calendar dates, not timestamps. The end date is inclusive. Stopping a series prevents new occurrences and cancels already generated future occurrences that are unpaid and unmatched; paid or matched history is never rewritten. Editing an active series cancels that same future unpaid/unmatched tail and regenerates it from the new definition. An occurrence remains an ordinary obligation and may be edited or matched independently.

## Consequences

### Positive

- Forecast and upcoming views consume one obligation representation and cannot double-count templates.
- SQL uniqueness plus a household-row transaction lock makes generation safe to repeat and concurrent.
- No background scheduler or ledger side effect is required.

### Negative / trade-offs

- Cancelling a series changes the planning state of its future unmatched occurrences, so users do not keep seeing cancelled recurring bills as active.
- Materialization is intentionally bounded; a later maintenance action must extend rows beyond 90 days.

## Alternatives considered

- RFC5545/RRULE: rejected for the MVP as unnecessary complexity.
- Generating infinite future rows: rejected because it creates uncontrolled storage growth.
- Summing definitions directly in forecast: rejected because it duplicates ordinary obligations and risks double counting.

## Follow-up

- Add an explicit per-occurrence cancellation action if users need to remove already-materialized future rows without affecting the series.
