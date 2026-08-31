# Nodvis Finance documentation

This directory is the design source of truth for Nodvis Finance while the project is in the pre-implementation stage.

## Start here

| Document | Purpose |
| --- | --- |
| [`product.md`](product.md) | Product definition, goals, principles and boundaries |
| [`mvp.md`](mvp.md) | MVP scope and explicit non-goals |
| [`domain.md`](domain.md) | Financial concepts and invariants that implementation must preserve |
| [`ux.md`](ux.md) | Primary UX model and core flows |
| [`architecture.md`](architecture.md) | Architecture constraints that are already known before stack selection |
| [`threat-model.md`](threat-model.md) | Initial security/threat model |
| [`adr/`](adr/) | Architectural Decision Records |
| [`reference/`](reference/) | Historical/source planning documents |

## Documentation hierarchy

When documents disagree, use this priority until the discrepancy is resolved:

1. accepted ADR for an architectural decision,
2. explicit domain invariant in `domain.md`,
3. current MVP/product document,
4. roadmap,
5. historical reference documents.

A code implementation must not silently override a financial invariant.

## Current design status

The repository is in **Phase 0 — product, domain and security design**. Some models are intentionally not final yet. Documents should clearly distinguish between:

- **accepted constraints**,
- **planned behavior**,
- **open decisions**.

## Updating documentation

When a change alters financial meaning, security boundaries or architectural assumptions, update the relevant design document in the same change. Material architectural decisions should receive an ADR rather than being buried in implementation code.
