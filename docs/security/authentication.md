# Authentication and sessions

Better Auth 1.7.2 is the sole authentication system. Email/password hashing and verification remain inside Better Auth's reviewed implementation; Nodvis does not read or print password hashes. The configured password length is 12–128 characters, with no arbitrary composition rule.

The canonical first-install Compose file permits the setup wizard to create exactly one initial owner. The PostgreSQL-backed `instance_state` singleton is claimed during the first auth-user insert and locked during bootstrap; once the first household is committed, the auth route and database trigger close public sign-up automatically. No public override is provided. No shared bootstrap password or repository token is used.

Better Auth owns session cookies and session persistence. Raw session tokens must never be displayed or logged. TOTP/2FA, passkeys, user-visible session listing/revocation and password-change UI are open implementation items. The current HTTP LAN deployment must not be treated as transport-confidential.
