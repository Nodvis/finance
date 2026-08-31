# Security Policy

Nodvis Finance handles highly sensitive household financial data. Security is a product requirement, not a post-MVP hardening task.

## Current project status

The repository is currently in **Phase 0 — product/domain/security design**.

The software is **not ready for production use or real financial data** until the security architecture, authentication model, storage model and backup/restore process have been implemented and reviewed.

## Never commit

Do not commit any of the following:

- bank logins,
- passwords,
- PINs,
- real credentials,
- production secrets,
- API keys or tokens,
- real bank statements,
- real payment confirmations,
- real invoices or receipts containing sensitive data,
- unredacted personal financial exports,
- encryption keys.

Use synthetic or fully anonymized fixtures for tests and examples.

## Security principles

### Self-hosted first

The first versions are intended for private self-hosted deployment. Preferred access patterns are LAN, VPN/Tailscale, or a reverse proxy with TLS. A raw public HTTP port is not an acceptable deployment recommendation.

### Separate application boundary

Nodvis Finance must remain isolated from other Nodvis products:

- separate repository,
- separate database,
- separate secrets,
- separate authentication deployment/instance where applicable,
- no shared database with Nodvis Recall.

### Authentication

Authentication must use a reviewed library/provider rather than custom password cryptography. The auth ADR must address at minimum:

- secure password/session handling,
- secure cookies where applicable,
- CSRF protection,
- rate limiting,
- session invalidation,
- future TOTP/passkey support.

### Sensitive storage

Before document storage or sensitive file persistence ships, the design must explicitly cover:

- encryption at rest where appropriate,
- key storage outside the database,
- backup encryption,
- key rotation,
- restore behavior,
- consequences and recovery model for key loss.

Do not introduce application-level cryptography without a documented key-management design.

### Telemetry defaults

Self-hosted defaults should be privacy-preserving:

```text
analytics: off
telemetry: off
external crash reporting: off
external AI: off
```

Any future external processing of financial data must be explicit opt-in.

### Backups

Backup is part of security. A supported production design must eventually provide a documented process for:

1. backup,
2. restore,
3. verification.

Encrypted export/backup is preferred for sensitive data.

## Upload and document handling

Uploaded files should be treated as untrusted input. Before the document feature is considered production-ready, the implementation must define controls for:

- file type and size validation,
- safe storage paths,
- filename normalization,
- content handling and parsing isolation,
- malicious attachment scenarios,
- access control,
- retention and deletion.

## Reporting a vulnerability

This repository is currently private and pre-release. Report suspected vulnerabilities privately to the repository owner/maintainers rather than opening a public disclosure.

A public disclosure process and dedicated security contact can be added before any public release.

## Threat model

See [docs/threat-model.md](docs/threat-model.md).
