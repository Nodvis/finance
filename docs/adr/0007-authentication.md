# ADR-0007: Authentication stack

- Status: Accepted
- Date: 2026-08-31

## Context

Nodvis Finance handles highly sensitive financial and document data. Authentication must therefore use a maintained security-focused library rather than custom password/session cryptography.

The first deployment is self-hosted and expected to serve a very small household, but the design should not make stronger authentication difficult to add later.

## Decision

Use **Better Auth 1.7.x** with PostgreSQL through its Drizzle adapter.

### Initial authentication mode

Start with:

- email + password credentials,
- server-side session validation,
- secure cookie-based browser sessions,
- no social login enabled by default.

Password hashing, credential storage and session primitives are delegated to Better Auth. Do not implement custom password crypto.

### Application boundary

Finance has its own Better Auth configuration and auth tables within the Finance database/deployment boundary.

It must not reuse Recall's sessions, users table, auth secrets or cookies.

A future Nodvis-wide account system, if ever desired, requires a separate ADR and explicit protocol-level integration rather than shared database tables.

### Authorization

Authentication does not imply authorization.

Every privileged server operation must authorize the current user against the relevant household/resource. Do not rely solely on:

- hidden UI,
- route layout checks,
- `proxy.ts`,
- client-side state.

Authorization belongs at the server operation/data-access boundary.

### Security defaults

Production configuration must use:

- HTTPS at the deployment edge,
- `Secure` cookies when served over HTTPS,
- `HttpOnly` session cookies where applicable,
- appropriate same-site/cross-site cookie policy,
- explicit trusted origins,
- rate limiting for authentication-sensitive endpoints,
- sufficiently strong random application/auth secrets kept outside Git.

Do not log passwords, session tokens, TOTP secrets, reset tokens or equivalent credentials.

### Stronger authentication

Better Auth's maintained plugins make these planned extensions possible without changing the auth framework:

- TOTP two-factor authentication,
- backup codes,
- passkeys/WebAuthn.

They are not required in the first scaffold. Their user-facing enrollment/recovery policy must be designed before enabling them.

### Account recovery

Account recovery must be designed together with the deployment model. Do not add insecure password-reset shortcuts merely because the instance is self-hosted.

If email-based password reset is introduced, outbound mail configuration and token handling require an implementation/security review.

## Consequences

### Positive

- Avoids custom password and session security code.
- Works with the selected Next.js/TypeScript/PostgreSQL stack.
- Supports future TOTP/passkeys.
- Finance remains isolated from other Nodvis products.

### Negative / trade-offs

- Authentication schema is partly shaped by a third-party library.
- Better Auth upgrades can require auth schema/data migrations and must be reviewed carefully.
- Strong-auth enrollment and recovery UX still require product decisions.

## Alternatives considered

### Auth.js

Mature and viable, but Better Auth currently offers a broader integrated credential/session/plugin model for the planned password + TOTP/passkey direction.

### Custom auth

Rejected. The security risk and maintenance cost are unjustified.

### External identity provider as a hard dependency

Rejected for self-host-first MVP because the application should not require a central cloud identity service to work privately.

## Upgrade policy

Auth dependency upgrades are security-sensitive changes.

When Better Auth requires a schema migration:

1. read the version-specific upgrade guide,
2. generate/review the auth schema change,
3. back up the database,
4. test migration and login/session behavior,
5. deploy schema and application changes coherently.

## Follow-up

- Implement Better Auth only after the initial database package exists.
- Add authenticated household authorization tests before financial data mutation features.
- Create a later ADR for TOTP/passkey enrollment and recovery policy when promoted into scope.
