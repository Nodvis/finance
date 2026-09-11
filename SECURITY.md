# Security status

Nodvis Finance handles highly sensitive household financial data. This document is an evidence-based status report, not an OWASP certification and not a claim that the application is fully secure. The project accepts private security reports; please do not publish exploitable vulnerability details in a public issue.

## Reporting a vulnerability

Use GitHub private vulnerability reporting for this repository when available. If it is unavailable, contact the maintainer through the private channel listed on the Nodvis project profile. Include the affected version, reproduction steps, impact and a safe contact method. Do not include live credentials or real household data.

## Current controls

- **Authentication:** Better Auth 1.7.2 with email/password and its database-backed sessions. Password handling remains inside Better Auth; the application does not store plaintext passwords or implement custom password cryptography. Passwords are configured for 12–128 characters. Private Compose disables new signup by default; set `ALLOW_SIGN_UP=true` only for an explicit bootstrap window, then restart with it disabled. CI may enable signup through `CI=true`.
- **Authorization:** server routes resolve the authenticated user to household membership before accessing household resources. Client-side navigation is not the authorization boundary.
- **Origin/CSRF boundary:** custom mutating `/api/*` requests with an `Origin` header must use `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL`; Better Auth routes retain Better Auth's own origin checks. Automated coverage is in `apps/web/src/proxy.test.ts`. Requests without Origin are still accepted for non-browser/API clients and require separate authentication/authorization.
- **Rate limiting:** Better Auth rate limiting is enabled. CI signup relaxation is explicit and scoped to CI.
- **Browser headers:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and private no-store caching for API responses are configured in `apps/web/next.config.ts`. HSTS is intentionally not enabled while the supported private deployment is plain HTTP.
- **Runtime:** the web image runs as a non-root user. Compose adds `no-new-privileges`, drops all Linux capabilities, uses a read-only root filesystem and a restricted `/tmp` tmpfs. PostgreSQL is internal to the Compose network in `compose.yaml`.
- **Privacy defaults:** no external analytics, crash reporting, AI processing or financial-data integrations are enabled by default.

## Data classification and boundaries

| Class | Examples | Persistence/processing | Default logging/export behavior |
|---|---|---|---|
| Extremely sensitive | password hashes, sessions, auth secret, future TOTP/key material, DB credentials | Better Auth tables, deployment secrets, backups | Never intentionally logged; excluded from user export |
| High sensitivity | account identifiers, balances, transactions, debt, BNPL, limits, schedules, household membership, backups | PostgreSQL and authenticated server/UI paths | No telemetry; exports must be authenticated and explicit |
| Personal data | name, email, IP/user-agent metadata | Auth and household tables, request context | Minimize and redact where operational logs are added |
| Lower sensitivity | generic categories, non-identifying UI preferences | PostgreSQL/UI | No external telemetry by default |

The current application does **not** provide application-level encryption for financial columns. PostgreSQL volume and backups therefore remain highly sensitive. Application-level encryption would mitigate stolen-dump/backup exposure but not a compromised running host; a key-management design is required before shipping it.

## Known limitations and open controls

- TOTP/2FA and passkeys are not yet implemented. Passkeys require an HTTPS origin and are not forced onto the current HTTP LAN deployment.
- Encrypted backup workflow and application-level field encryption are not yet implemented. Existing unencrypted backups must be treated as sensitive.
- Database role separation between web, migrator and backup identities is not yet implemented; do not expose PostgreSQL beyond the private host/network.
- A complete CSP, formal ASVS evidence set, DAST baseline, exhaustive BOLA matrix, security-event audit log and session-management UI remain open.
- The current private URL uses HTTP. Use a trusted HTTPS reverse proxy/VPN for sensitive remote access; do not expose the service publicly.
- No formal security certification is claimed.

## Verification evidence

Run the repository's pinned commands with Node 24 and pnpm 11:

```text
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Security-specific tests currently include origin rejection/allow-list coverage in `apps/web/src/proxy.test.ts`, plus the existing authenticated household authorization and financial invariant tests. Results must be recorded from the actual run; written tests are not evidence of execution.

See `docs/security/` for the architecture, data inventory, deployment, backup, incident-response and ASVS evidence documents.
