# UX direction

## Principle

> **The user should receive an answer, not a system to administer.**

Nodvis Finance may perform complex reconciliation, classification, deduplication and forecasting internally. The default experience should hide that complexity until it is needed.

## Primary persona test

A useful mental model is a person who, in a spreadsheet, mostly opens the **Summary** tab rather than maintaining formulas or inspecting transaction mechanics.

If that person would avoid the application because it feels like accounting software, the UX is moving in the wrong direction.

## Navigation model

Use progressive disclosure rather than an explicit “easy/pro mode”.

### Primary navigation

- **Home / Summary**
- **Plan**
- **Upcoming**

### More

- Transactions
- Accounts
- Debts & installments
- Budget
- Documents
- Analytics
- Import
- Settings

A non-technical household member should be able to use the application productively without frequently opening the deeper sections.

## Home / Summary

The dashboard is the most important screen.

It should contain few metrics, but they must be decision-relevant.

### Available now

How much money is actually accessible now.

### To pay

Known upcoming obligations, especially over useful windows such as 7 and 30 days.

### Debt

Total outstanding debt and useful trend, e.g. month-over-month reduction.

### Current month

High-level income, spending and known obligations.

### Status

A concise interpretation, for example:

```text
Safe
After known payments, approximately 1,430 PLN should remain.
```

or:

```text
Tight
Before the next expected income, projected shortage is approximately 720 PLN.
```

Status wording must not imply false certainty when inputs are incomplete or forecasts are uncertain.

## Core questions on Home

The Home screen should make these easy to answer:

- How much do we have available now?
- How much must we pay?
- Will it likely last until the next income?
- How much debt remains?
- How much debt was reduced recently?
- Where are we overspending?
- What can we realistically do this month?

## Add data

The main add-data entry should be simple:

```text
Add data
├── Bank statement
├── Receipt
├── Invoice
├── Payment confirmation
├── Loan schedule
└── Add manually
```

The user should not need to know internal entity names before adding information.

## Import review

Import UX should summarize the result rather than expose parser internals.

Example:

```text
Detected: Credit Agricole
Account: Eryk — CA

84 records

74 new
7 already present
2 probable transfers
1 needs review

[Import]
```

The review flow should emphasize:

- confidence,
- duplicates,
- probable transfers,
- ambiguous records,
- user-correctable categorization.

## Document inbox

A document can be added before the user knows exactly where it belongs.

Simple entry point:

```text
+ Add document
```

Unassigned items can go to an inbox such as **To organize** and later be attached to a transaction, loan, installment or import.

## Planning UX

Planning should show trade-offs rather than preach one budgeting method.

Potential modes/scenarios include:

- stabilization,
- 50/30/20 benchmark,
- Pay Yourself First,
- debt avalanche,
- debt snowball,
- custom scenario.

For uncertain income, distinguish scenarios such as conservative/base/optimistic rather than showing one false-precision number.

## Error and uncertainty handling

Prefer explicit uncertainty over invented facts.

Good:

```text
Source unknown
Match uncertain
Estimated amount
Likely transfer
```

Bad:

- forcing a fabricated source for cash,
- silently merging uncertain transactions,
- automatically marking expected obligations as paid,
- presenting a forecast as an actual account balance.

## Localization

Polish is the first real usage language, but every UX flow must be designed so English works without architectural changes.

Avoid layouts that depend on one language having short labels. Numbers, dates and currencies must follow locale rules.
