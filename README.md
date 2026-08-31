# Nodvis Finance

> Private, self-hosted household finance control center.

Nodvis Finance is a household finance application focused on a simple question:

**What do we actually have, what do we owe, what must we pay next, and what is the safest plan for improving our situation?**

It is not intended to be another accounting-style ledger or a pure envelope-budgeting clone. Its core is the combination of **available cash, obligations, debt, cash flow and forecasting** presented in a way that remains useful to non-technical users.

> [!IMPORTANT]
> **Project status: Phase 0 / foundation scaffold.**
> Architecture decisions and the first application/domain/database skeleton now exist, but the application is **not ready for real financial data or production use**.

## Product principles

- **Available cash is not debt outstanding.** Both matter, but they answer different questions.
- **An obligation is not a transaction.** Planned payments affect forecasts, not actual balances.
- **Transfers are not income or spending.** Moving money between owned accounts must not distort analytics.
- **Credit-card purchases and card repayments are different events.** A repayment must not count the original purchase twice.
- **Unknown is a valid state.** Preserve uncertainty instead of inventing financial history.
- **The core works without AI or paid APIs.** Deterministic rules and financial math come first.
- **Self-hosted first.** The first supported product is private/self-hosted.
- **Security is part of the MVP.** Financial data, documents, backups and secrets are sensitive from the beginning.
- **PL + EN from the first scaffold.** Dates, numbers, currencies and strings must be locale-aware.
- **Progressive disclosure.** The home screen should answer questions; complexity belongs behind deeper views.

## What the product should answer

After importing data and entering obligations, a household should be able to answer in under a minute:

- How much money is available now?
- How much debt is outstanding?
- What must be paid soon?
- How much are we actually spending and on what?
- Does the current month work financially?
- What is the safest realistic plan for improving the situation?

## Current technology foundation

The accepted foundation is documented in `docs/adr/`.

- **Node.js 24 LTS**
- **TypeScript 7** in strict mode
- **pnpm 11 workspace**
- **Next.js 16 / React 19**
- **next-intl** with `/pl` and `/en` from the start
- **Tailwind CSS 4**
- **PostgreSQL 18**
- **Drizzle ORM** stable line with reviewed SQL migrations
- **Better Auth** for authentication
- **Zod 4** at untrusted boundaries
- **Vitest** for domain/unit tests
- **Playwright** for browser smoke/E2E tests
- **Docker Compose** as the initial self-hosted deployment reference

The application is a **modular monolith**, not a microservice system.

## Repository map

```text
.
├── apps/
│   └── web/                    # Next.js application, PL/EN UI
├── packages/
│   ├── domain/                 # framework-independent financial logic
│   └── db/                     # PostgreSQL / Drizzle schema and access
├── e2e/                        # Playwright tests
├── docs/
│   ├── README.md
│   ├── product.md
│   ├── mvp.md
│   ├── domain.md
│   ├── architecture.md
│   ├── threat-model.md
│   ├── ux.md
│   ├── adr/
│   │   ├── 0001-self-hosted-first.md
│   │   ├── 0002-separate-application-boundary.md
│   │   ├── 0003-i18n-from-the-first-commit.md
│   │   ├── 0004-core-without-mandatory-ai.md
│   │   ├── 0005-technology-stack.md
│   │   ├── 0006-persistence-and-money.md
│   │   ├── 0007-authentication.md
│   │   └── 0008-deployment-topology.md
│   └── reference/
│       └── product-spec-2026-08-31.md
├── AGENTS.md                    # mandatory rules for coding agents
├── ROADMAP.md
├── SECURITY.md
├── CONTRIBUTING.md
├── compose.dev.yaml
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Development bootstrap

Requirements:

- Node.js 24 LTS
- pnpm 11 (the repository pins `pnpm@11.24.0` through `packageManager`)
- Docker + Docker Compose for the development PostgreSQL service

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create local environment

```bash
cp .env.example .env
```

The provided values are development placeholders only. Never reuse them for a real deployment.

### 3. Start PostgreSQL

```bash
docker compose -f compose.dev.yaml up -d
```

The development database binds only to `127.0.0.1:5432` by default.

### 4. Database migrations

The first schema exists in code. Before using it, generate and review the corresponding Drizzle migration:

```bash
pnpm db:generate
pnpm db:migrate
```

Generated SQL migrations are source artifacts and should be reviewed and committed. `drizzle-kit push` is **not** the production migration workflow.

### 5. Start the application

```bash
pnpm dev
```

The initial UI supports:

- `/pl`
- `/en`

It intentionally displays empty financial values rather than fake sample money.

## Verification commands

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Financial-domain tests have higher priority than cosmetic UI coverage.

## Money representation

Canonical money is not a floating-point `number`.

The domain foundation uses:

```text
Money {
  amountMinor: bigint
  currency: explicit currency code
}
```

Example:

```text
12.34 PLN -> 1234n + PLN
```

Cross-currency arithmetic must be explicit and cannot happen accidentally through the `Money` primitive.

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

## Architecture and ADRs

Start with:

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/domain.md`](docs/domain.md)
- [`docs/threat-model.md`](docs/threat-model.md)
- [`docs/adr/README.md`](docs/adr/README.md)

Material architectural decisions are recorded rather than being silently embedded in implementation.

## AI coding agents

`AGENTS.md` is repository-wide mandatory context for coding agents.

Among other rules, agents must preserve the financial invariants, exact-money model, security boundaries, PL/EN requirement and reviewed migration workflow. Implementation convenience does not override the documented domain model.

## Security

Do **not** commit:

- real bank statements,
- credentials or production secrets,
- passwords/PINs/session tokens,
- personally sensitive financial documents,
- real production backups.

Self-hosted defaults must not require analytics, telemetry, external crash reporting or external AI.

See [`SECURITY.md`](SECURITY.md) and [`docs/threat-model.md`](docs/threat-model.md).

## Related Nodvis projects

Nodvis Finance is intentionally a separate application from Nodvis Recall and other Nodvis products. It has its own repository, persistence and authentication boundary. Any future integration must use an explicit interface rather than a shared database.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md).

The next implementation work should stay narrow: establish the first Phase 1 household/account/transaction model and authentication boundary while preserving the documented invariants. Imports, debt planning, documents and advanced forecasting come in later phases rather than being built all at once.

---

**Nodvis Finance** — know what you have, what you owe, and what comes next.
