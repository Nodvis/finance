# Security architecture

## Scope

Nodvis Finance is a private self-hosted modular monolith: browser -> Next.js web runtime -> PostgreSQL. Better Auth owns email/password authentication and sessions. Finance routes authorize `session user -> household membership -> resource household` at server boundaries.

## Data flows

The browser sends authenticated same-origin requests to the web runtime. Custom mutating API requests are rejected when an explicit Origin is not in the configured application-origin allow-list. Better Auth routes use Better Auth's trusted-origin and CSRF mechanisms. PostgreSQL is not published by the reference Compose file.

## Threat coverage

Current controls reduce accidental cross-origin mutations, clickjacking, MIME confusion, referrer leakage, capability abuse and container privilege. They do not protect a compromised host, an exposed HTTP transport, an unencrypted stolen database dump, or an attacker with valid credentials.

## Explicit non-goals

No public hosting, direct bank credential synchronization, external AI processing, custom password cryptography or ad-hoc encryption is enabled.
