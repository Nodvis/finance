# ADR-0002: Separate application boundary

- Status: Accepted
- Date: 2026-08-31

## Context

Nodvis Finance and Nodvis Recall may eventually have related data, but they solve different problems and carry different security implications. Finance handles especially sensitive financial records and should not inherit unnecessary coupling from another product.

## Decision

Nodvis Finance remains a standalone application with explicit boundaries.

Required separation:

- separate repository,
- separate database,
- separate secrets,
- separate authentication deployment/instance where applicable,
- no shared database,
- no mandatory runtime dependency on Nodvis Recall,
- no generic shared `Nodvis Core` persistence layer.

Future integration may be introduced only through an explicit, documented interface when there is a real user benefit.

## Consequences

### Positive

- smaller blast radius,
- clearer ownership of sensitive data,
- independent migrations and releases,
- easier security reasoning,
- Finance can operate without Recall.

### Negative / trade-offs

- some duplicated infrastructure/configuration may exist,
- future integrations require explicit API/event/link design,
- shared concepts cannot be implemented by simply joining databases.

## Alternatives considered

### Shared database / shared core

Rejected because it couples security boundaries, schemas, deployments and lifecycle of unrelated products.

### Mandatory Recall integration

Rejected because Finance must remain useful independently.

## Follow-up

If cross-product linking is introduced later, create a dedicated ADR covering:

- data exchanged,
- authorization,
- identifiers,
- failure behavior,
- privacy impact,
- whether integration is one-way or bidirectional.
