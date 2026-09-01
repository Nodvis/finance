# Product definition

## Name

**Nodvis Finance**

Repository: `Nodvis/finance`

## Status

**Phase 1 — core financial foundation in progress**

## Product statement

Nodvis Finance is a **private, self-hosted household finance control center**.

It is designed to answer:

> What is our actual financial situation, what must we pay, what do we owe, how much money is available, and what plan can safely improve the situation?

The product may learn from tools such as Actual Budget, Firefly III and YNAB, but it is not intended to be a clone of any of them.

## Primary user problem

A household may have:

- separate personal bank accounts,
- joint accounts,
- fintech accounts such as Revolut,
- cash,
- loans,
- credit cards,
- installments,
- BNPL / pay-later obligations,
- transfers between owned accounts,
- shared and personal expenses,
- different repayment schedules.

A useful product must represent these without forcing the user into accounting concepts they do not need to understand.

## UX principle

> **The user should receive an answer, not a system to administer.**

The most important usability test is whether somebody who normally looks only at a spreadsheet's summary tab would still want to open the application.

The default screen should make it easy to understand:

- how much is available now,
- what must be paid,
- whether money should last until the next income,
- total debt and recent debt reduction,
- unusually high spending,
- what can realistically be done this month.

Detailed accounting/reconciliation information should be available only when needed.

## Core product model

The application maintains several views of financial reality in parallel:

### Available cash

Money that can actually be used now.

### Debt outstanding

Remaining liabilities.

### Upcoming obligations

Known or expected payments that must be made soon.

### Cash flow

Actual money moving in and out.

### Net worth

An optional analytical metric, not the dominant home-screen value.

The application must not collapse these into one misleading number.

## Product center

Budgeting is a module, not the whole product.

The center of Nodvis Finance is:

**financial situation + forecast + obligations + debt**

## Input model

Direct bank login/sync is not required for the first versions.

Initial input should come from:

- bank statements,
- CSV,
- PDF,
- payment confirmations,
- loan/installment schedules,
- receipts/invoices,
- manual entry.

The application must never require storing bank usernames, bank passwords or PINs.

## Import strategy

First planned import adapters:

- Credit Agricole,
- PKO BP,
- mBank,
- Revolut,
- generic CSV.

Later formats may include CAMT.053, OFX/QFX, QIF and MT940.

Import should be reviewable, deduplicated and auditable rather than a blind append operation.

## Automation strategy

Prefer deterministic rules before AI.

Examples:

```text
LIDL    -> groceries
ORLEN   -> fuel
NETFLIX -> subscriptions
```

After user correction, the product may offer to persist a rule.

This creates useful automation without requiring a model or paid API.

## AI position

The core product must work without AI and without paid APIs.

Potential future AI uses:

- OCR,
- extraction from documents,
- classification of unknown descriptions,
- document assistance.

External AI must be explicit opt-in, especially when complete financial statements could leave the self-hosted environment.

## Planning modes

The product should not impose one universal budgeting philosophy. Planned strategies include:

- stabilization mode,
- 50/30/20 as a benchmark rather than a rule,
- Pay Yourself First,
- debt avalanche,
- debt snowball,
- sinking funds,
- staged emergency/safety buffer,
- custom scenarios.

Recommendations should adapt to real cash flow rather than prescribing impossible percentages.

## Forecast philosophy

Forecasting must not pretend to know the future exactly.

When appropriate, forecasts should support uncertainty such as:

- conservative,
- base,
- optimistic.

A forecast value is an estimate, not an actual balance.

## Localization

Polish and English are supported from the start at the architecture level.

Foundation requirements:

- `pl`,
- `en`,
- locale-aware dates,
- locale-aware numbers,
- locale-aware currency formatting,
- translation keys,
- no scattered hardcoded user-facing strings.

Polish is the first real usage language.

## Deployment direction

The first version is **self-hosted only**.

Reasons:

- financial data is highly sensitive,
- initial usage is private,
- there is no need to host third-party financial data during early development,
- security can be tested in a controlled environment.

Preferred access includes LAN, VPN/Tailscale or reverse proxy + TLS.

## Product boundaries

Nodvis Finance is separate from Nodvis Recall.

Required boundaries:

- separate repository,
- separate database,
- separate secrets,
- separate authentication instance/deployment where applicable,
- no mandatory dependency,
- no shared `Nodvis Core` database.

Future integration is allowed only when it becomes natural and explicit.

## MVP success definition

The MVP succeeds when, after importing data and entering obligations, the user can answer in under one minute:

1. How much money do we have?
2. How much do we owe?
3. What must we pay soon?
4. How much do we really spend?
5. What do we spend it on?
6. Does the current month work financially?
7. What is the safest realistic plan for improving the situation?

Feature count and chart count are not success criteria.
