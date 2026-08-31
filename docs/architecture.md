# Architecture constraints

> Status: pre-stack architecture guidance. This document intentionally does **not** choose the application framework, database, ORM or authentication library.

## Current state

Nodvis Finance is in Phase 0. The implementation stack must be selected in a dedicated ADR after product/domain/security requirements are sufficiently stable.

## Known architectural constraints

### 1. Self-hosted first

The first supported deployment model is self-hosted.

Architecture should support practical private deployment through mechanisms such as:

- LAN,
- VPN/Tailscale,
- reverse proxy + TLS.

The project should not assume a mandatory central Nodvis cloud service.

### 2. Standalone application boundary

Nodvis Finance is a separate application from Nodvis Recall and other products.

Required isolation:

- separate repository,
- separate database,
- separate secrets,
- separate auth instance/deployment where applicable,
- no shared persistence model,
- no mandatory runtime dependency on another Nodvis product.

Future integrations should use explicit interfaces rather than database coupling.

### 3. Core works offline from paid/external AI

The financial model, imports, deduplication, categorization rules, forecasts and debt simulations must be implementable without external LLM APIs.

Any future external AI integration must be optional and privacy-aware.

### 4. Internationalization is foundational

The architecture must support Polish and English from the initial application scaffold.

User-visible formatting must be locale-aware for:

- strings,
- dates,
- numbers,
- currency.

### 5. Domain semantics over persistence convenience

The data model must preserve the distinctions documented in `domain.md`.

Do not flatten concepts such as:

- planned obligation vs actual transaction,
- account balance vs outstanding debt,
- expense vs transfer,
- purchase vs credit-card repayment,
- loan principal vs interest.

Persistence design should follow the domain rather than forcing the domain into a generic ledger abstraction that loses meaning.

### 6. Import provenance

The import architecture should retain a trace from source material/raw records to normalized domain records.

This is necessary for:

- debugging parsers,
- deduplication,
- reconciliation,
- user trust,
- future parser migrations.

### 7. Idempotency and reconciliation

Import paths should be designed for repeated/overlapping source data rather than assuming every file contains only new records.

Where identity cannot be proven, the system should support confidence/review instead of silent destructive merging.

### 8. Sensitive document boundary

Document upload/storage is security-sensitive and should have a deliberately designed subsystem.

Do not add generic file upload to production before decisions exist for:

- storage location,
- encryption/key management,
- access control,
- validation,
- backups,
- malicious-file handling,
- retention/deletion.

### 9. Backup and restore are architecture features

A production-ready deployment needs a coherent backup model covering all persistent state required for restoration.

Backup design should make it possible to verify restoration rather than only copy files/database dumps.

### 10. Privacy-preserving defaults

Self-host defaults should not rely on outbound telemetry, analytics, crash reporting or external AI.

## Candidate deployment shape

The exact stack is undecided, but a future implementation will likely need logical components equivalent to:

```text
Browser / client
      |
      v
Application / API
      |
      +--> relational/domain persistence
      |
      +--> import processing
      |
      +--> document storage (when designed)
      |
      +--> background work (only if/when required)
```

This diagram is conceptual, not a commitment to separate services. Prefer the simplest deployment that satisfies security and domain requirements.

## Decisions still requiring ADRs

Before implementation or before the relevant feature ships, record decisions for:

- technology/application stack,
- persistence/database,
- authentication,
- deployment topology,
- sensitive document storage,
- encryption/key management,
- backup/restore format,
- background jobs/queues if introduced,
- API boundaries if frontend/backend are separated.

## Architecture bias

Until scale proves otherwise:

- prefer a simple deployable system over microservices,
- prefer explicit domain code over infrastructure cleverness,
- prefer deterministic behavior over opaque automation,
- prefer recoverable/auditable operations over destructive convenience.

These are biases, not final technology decisions.
