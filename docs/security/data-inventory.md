# Data inventory

| Data | Class | Stored/processed | Logs | Backup/host boundary | Access |
|---|---|---|---|---|---|
| Password hash/session rows | Extremely sensitive | Better Auth PostgreSQL tables; auth server | Must not be logged | Included in DB backups; host-controlled | Better Auth/server only |
| Auth/database secrets | Extremely sensitive | Environment or secret file, not repository | Never | Host secret management/backups require separate protection | Process/deployment operator |
| Account identifiers and balances | High | Finance PostgreSQL; authenticated server/UI | Mask if operational context is needed | Included in DB backups; no field encryption yet | Household membership |
| Transactions, merchants, debt, BNPL, schedules | High | Finance PostgreSQL; authenticated server/UI | No raw financial content in security logs | Included in DB backups; no external telemetry | Household membership |
| Name/email | Personal | Auth/household tables; UI | Minimize | Included in DB backups | User/authorized household |
| IP/user-agent metadata | Personal | Auth/request context as Better Auth retains it | No raw secrets | Host/database policy | Security operations only |
| Categories/UI preferences | Lower | Finance PostgreSQL/browser UI | No telemetry | Included if persisted | Authorized user |

Retention is currently bounded by database and backup retention policy rather than per-record deletion workflows. Export must be explicit and authenticated; auth hashes, sessions and deployment secrets are excluded.
