# Nodvis Finance threat model

> Status: living engineering model updated for the current authenticated finance application. This is not a security certification.

## Security objective

Nodvis Finance must protect the confidentiality, integrity and recoverability of highly sensitive household financial data while remaining practical to self-host.

## Assets to protect

### Highest sensitivity

- transaction history,
- account balances,
- debt balances and schedules,
- financial documents and statements,
- personally identifiable information contained in imports/documents,
- authentication credentials/session material,
- encryption keys,
- backups.

### Integrity-sensitive

- normalized transactions,
- transfer relationships,
- obligation/payment matching,
- debt principal/interest calculations,
- forecast inputs,
- categorization rules,
- import provenance/audit trail.

Incorrect modification can be harmful even if no data is disclosed, because the product is intended to support financial decisions.

## Trust boundaries

Potential trust boundaries include:

1. user browser/client,
2. application server,
3. database,
4. document/file storage,
5. backup destination,
6. reverse proxy/TLS boundary,
7. local network/VPN,
8. imported files from banks/users,
9. optional future external services,
10. host operating system/container runtime.

The exact boundaries depend on the deployment ADR.

## Primary threat scenarios

### TM-001 — Database disclosure

**Scenario:** attacker obtains a database dump or read access to persistence.

**Impact:** disclosure of balances, transactions, debts, household relationships and potentially metadata pointing to documents.

**Design expectations:**

- least-privilege database credentials,
- credentials outside repository,
- secure deployment defaults,
- minimize unnecessary sensitive data,
- evaluate field/file encryption where it materially reduces risk,
- ensure encryption keys are not simply stored beside encrypted data.

**Current status:** PostgreSQL and backups are treated as high-sensitivity assets. Application-level field encryption and encrypted archival backups remain open; see `docs/security/encryption-and-key-management.md`.

### TM-002 — Backup theft

**Scenario:** backup archive, database dump or storage snapshot is copied from backup storage.

**Impact:** potentially complete historical disclosure.

**Design expectations:**

- encrypted backups for sensitive deployments,
- keys separated from backup payload,
- documented restore process,
- access control on backup destination,
- retention policy.

### TM-003 — Account takeover

**Scenario:** attacker obtains/guesses credentials or steals an authenticated session.

**Impact:** read/modify/export household financial data.

**Design expectations:**

- established authentication library/provider,
- strong password handling by the selected auth stack,
- secure session lifecycle,
- HttpOnly/Secure cookies where applicable,
- CSRF protection where applicable,
- rate limiting,
- logout/session revocation,
- future TOTP/passkey capability.

**Current status:** Better Auth 1.7.2 owns email/password and sessions. TOTP, passkeys, user-visible session revocation and complete password-reset evidence remain open.

### TM-004 — Insecure public deployment

**Scenario:** user exposes the application directly to the internet over an unsafe configuration such as raw HTTP on a public port.

**Impact:** credential/session interception, unauthorized access, increased attack surface.

**Design expectations:**

- documentation recommends LAN, VPN/Tailscale or TLS reverse proxy,
- production mode should not normalize unsafe public HTTP exposure,
- secure cookie behavior must match deployment model.

### TM-005 — Malicious imported document/file

**Scenario:** crafted PDF/CSV/image/document exploits parser behavior, path handling or upload processing.

**Impact:** denial of service, arbitrary file access/write, parser compromise, code execution depending on libraries.

**Design expectations before document feature ships:**

- file size limits,
- file type/content validation,
- normalized/generated storage names,
- never trust user filename as path,
- safe parser libraries/process isolation where appropriate,
- no execution of uploaded content,
- explicit document access authorization,
- resource limits for expensive parsing.

### TM-006 — Host compromise

**Scenario:** attacker controls the machine/VM/container host running Nodvis Finance.

**Impact:** likely complete compromise of application data and runtime secrets.

**Design expectation:**

Application-level encryption may reduce some offline-data risks but cannot promise confidentiality against an attacker who controls the running process and can access decryption keys.

Documentation must not overstate what encryption can protect from host compromise.

### TM-007 — Secrets committed to repository

**Scenario:** developer accidentally commits production credentials, keys or real statements.

**Impact:** persistent secret/data exposure through repository history and clones.

**Design expectations:**

- `.env*` ignored except safe examples,
- synthetic fixtures only,
- clear `SECURITY.md`/`AGENTS.md` rules,
- secret scanning in CI can be considered once CI is established,
- rotation procedure when leakage occurs.

### TM-008 — Sensitive telemetry/external processing

**Scenario:** transaction descriptions, statements, errors or documents are sent to analytics, crash reporting or external AI without informed user consent.

**Impact:** financial data leaves the private deployment boundary.

**Design expectations:**

Defaults for self-hosted installations:

```text
analytics: off
telemetry: off
external crash reporting: off
external AI: off
```

Future integrations require explicit opt-in and clear data-flow documentation.

### TM-009 — Financial integrity corruption

**Scenario:** logic error or import behavior double-counts purchases, transfers or obligations.

**Impact:** incorrect financial status, forecast or debt planning leading to poor real-world decisions.

**Design expectations:**

- domain invariants are first-class tests,
- imports retain provenance,
- uncertain matching is reviewable,
- no automatic conversion of planned obligation into actual transaction,
- credit-card repayment cannot duplicate purchase expense,
- internal transfers cannot inflate income/spending.

This is both a correctness and security/trust risk.

### TM-010 — Import duplication/replay

**Scenario:** the same or overlapping statement is imported repeatedly.

**Impact:** corrupted balances/analytics and loss of trust.

**Design expectations:**

- source IDs where available,
- file hashes/import batches,
- deterministic deduplication signals,
- review of ambiguous matches,
- idempotent behavior where feasible.

### TM-011 — Unauthorized cross-household access

**Scenario:** future multi-household/multi-user logic allows one user to access another household's data.

**Impact:** severe confidentiality breach.

**Design expectations:**

- authorization enforced server-side at domain/data boundaries,
- never rely only on hidden UI/navigation,
- tests for object/household access isolation before multi-household hosting is supported.

For the initial private self-hosted phase, hosting unrelated third-party households is not a target use case.

### TM-012 — Key loss

**Scenario:** application encrypts documents/data but the encryption key is lost.

**Impact:** permanent loss of financial records/backups.

**Design expectations:**

The encryption design must define:

- where keys live,
- how they are backed up,
- rotation,
- restore,
- recovery expectations,
- user-visible consequences of key loss.

Do not ship ad-hoc encryption without this model.

## Abuse and privacy assumptions

The initial product assumes a household is intentionally sharing the deployment. More granular privacy between members may become a separate product requirement later; it must not be assumed from the current specification.

## Security work required before real-data production use

At minimum:

- [ ] authentication ADR accepted,
- [ ] deployment/TLS model documented,
- [ ] authorization model implemented and tested,
- [ ] secret handling documented,
- [ ] database/storage backup + restore tested,
- [ ] sensitive logging reviewed,
- [ ] core financial invariants covered by tests,
- [ ] import validation/resource limits implemented,
- [ ] document storage threat model completed before document uploads ship,
- [ ] dependencies and update process defined,
- [ ] production security checklist created.

## Current decisions and remaining questions

The following questions have concrete answers for the current public v0.1.x scope:

- Authentication uses Better Auth; authentication and household authorization remain separate boundaries.
- The supported self-hosting deployment is the Finance container plus PostgreSQL through the root Docker Compose file. Public cloud hosting is out of scope.
- PostgreSQL backup and restore use the documented `scripts/backup.sh` and `scripts/restore.sh` workflow; operators must protect the resulting backup files.

Questions intentionally left open for future scope:

- Which data/files require application-level encryption at rest?
- How are encryption keys stored and recovered?
- Will document parsing occur in-process or in a restricted worker?
- When/if public cloud hosting exists, how does the threat model change?

This document should be updated whenever a new trust boundary, external integration or sensitive data flow is introduced.
