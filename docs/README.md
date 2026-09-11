# Nodvis Finance documentation

This directory is the design source of truth for Nodvis Finance. The project is now a **public v0.1.x self-hosted application**, while the documentation remains authoritative for domain, security and architecture decisions.

## Start here

| Document | Purpose |
| --- | --- |
| [`product.md`](product.md) | Product definition, goals, principles and boundaries |
| [`mvp.md`](mvp.md) | MVP scope and explicit non-goals |
| [`domain.md`](domain.md) | Financial concepts and invariants that implementation must preserve |
| [`ux.md`](ux.md) | Primary UX model and core flows |
| [`architecture.md`](architecture.md) | Accepted application architecture and boundaries |
| [`threat-model.md`](threat-model.md) | Initial security/threat model |
| [`adr/`](adr/) | Accepted and proposed Architecture Decision Records |
| [`reference/`](reference/) | Historical/source planning documents |

Repository-level implementation rules for coding agents are in [`../AGENTS.md`](../AGENTS.md).

## Documentation hierarchy

When documents disagree, use this priority until the discrepancy is resolved:

1. accepted ADR for an architectural decision,
2. explicit domain invariant in `domain.md`,
3. current MVP/product document,
4. roadmap,
5. historical reference documents.

A code implementation must not silently override a financial invariant.

## Current design status

The repository is in **Public v0.1.x self-hosted application**.

Already accepted:

- self-hosted-first product boundary,
- separate Finance application/data/auth boundary,
- PL + EN from the application foundation,
- core product without mandatory AI,
- Node/TypeScript/Next.js application stack,
- PostgreSQL/Drizzle persistence direction,
- exact money as bigint minor units + currency,
- Better Auth direction,
- modular-monolith Docker deployment topology.

Still intentionally open until the relevant feature is promoted into scope:

- sensitive document storage,
- encryption/key management,
- backup/restore format and verification,
- durable background jobs,
- external/public API boundaries,
- strong-auth enrollment/recovery UX and policy.

Some detailed domain models are intentionally not final yet. Documents should distinguish between:

- **accepted constraints/decisions**,
- **planned behavior**,
- **open decisions**.

## Updating documentation

When a change alters financial meaning, security boundaries or architectural assumptions, update the relevant design document in the same change. Material architectural decisions should receive an ADR rather than being buried in implementation code.
