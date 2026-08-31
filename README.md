# Nodvis Finance

> Private, self-hosted household finance control center.

Nodvis Finance is a household finance application focused on a simple question:

**What do we actually have, what do we owe, what must we pay next, and what is the safest plan for improving our situation?**

The project is not intended to be another accounting-style ledger or a pure envelope-budgeting clone. Its core is the combination of **available cash, obligations, debt, cash flow and forecasting** presented in a way that remains useful to non-technical users.

> [!IMPORTANT]
> **Project status: Phase 0 — product, domain and security design.**
> The application is not ready for real financial data or production use yet.

## Product principles

- **Available cash is not debt outstanding.** Both matter, but they answer different questions.
- **An obligation is not a transaction.** Planned payments affect forecasts, not actual balances.
- **Transfers are not income or spending.** Moving money between owned accounts must not distort analytics.
- **Credit-card purchases and card repayments are different events.** A repayment must not count the original purchase twice.
- **Unknown is a valid state.** The system should preserve uncertainty instead of inventing financial history.
- **The core product must work without AI or paid APIs.** Rules and deterministic logic come first.
- **Self-hosted first.** The first versions are designed for private deployment rather than a hosted public cloud.
- **Security is part of the MVP.** Financial data, documents, backups and secrets are treated as sensitive from the beginning.
- **PL + EN from the first commit.** Dates, numbers, currencies and strings must be locale-aware.
- **Progressive disclosure.** The home screen should answer questions; complexity belongs behind deeper views.

## What the product should answer

After importing data and entering obligations, a household should be able to answer in under a minute:

- How much money is available now?
- How much debt is outstanding?
- What must be paid soon?
- How much are we actually spending and on what?
- Does the current month work financially?
- What is the safest realistic plan for improving the situation?

## Planned product areas

### Primary experience

- **Home / Summary** — available funds, upcoming obligations, debt and month status.
- **Plan** — forecast and realistic financial scenarios.
- **Upcoming** — what must be paid in the next days and weeks.

### Deeper views

- Transactions
- Accounts and cash
- Debts, credit cards, installments and BNPL
- Budget
- Documents
- Analytics
- Import
- Settings

## Data sources

The first versions will not require direct bank login or bank credentials. Planned inputs include:

- bank statements,
- CSV files,
- PDFs and payment confirmations,
- loan/installment schedules,
- receipts and invoices,
- manual entries.

Initial import adapters are expected to focus on Credit Agricole, PKO BP, mBank, Revolut and generic CSV.

## Repository map

```text
.
├── README.md
├── ROADMAP.md
├── SECURITY.md
├── CONTRIBUTING.md
├── AGENTS.md
└── docs/
    ├── README.md
    ├── product.md
    ├── mvp.md
    ├── domain.md
    ├── architecture.md
    ├── threat-model.md
    ├── ux.md
    ├── adr/
    │   ├── README.md
    │   ├── 0001-self-hosted-first.md
    │   ├── 0002-separate-application-boundary.md
    │   ├── 0003-i18n-from-the-first-commit.md
    │   └── 0004-core-without-mandatory-ai.md
    └── reference/
        └── product-spec-2026-08-31.md
```

The application source tree will be defined after the technology-stack ADR. The repository intentionally starts with the product/domain/security foundations instead of prematurely locking in implementation structure.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

The current priority is **Phase 0**: finalize the domain model, invariants, threat model, UX flows, MVP boundary and technology-stack ADR before application implementation begins.

## Security

Do **not** commit real bank statements, credentials, production secrets, passwords, PINs or personally sensitive financial documents.

See [SECURITY.md](SECURITY.md) and [docs/threat-model.md](docs/threat-model.md).

## Related Nodvis projects

Nodvis Finance is intentionally a separate application from other Nodvis products. It must not depend on a shared database or a mandatory shared core. Future integrations may be added only through explicit, well-defined boundaries.

---

**Nodvis Finance** — know what you have, what you owe, and what comes next.
