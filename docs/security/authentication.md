# Authentication and sessions

Better Auth 1.7.2 is the sole authentication system. Email/password hashing and verification remain inside Better Auth's reviewed implementation; Nodvis does not read or print password hashes. The configured password length is 12–128 characters, with no arbitrary composition rule.

The canonical first-install Compose file enables signup for the initial owner account. After that account is created, set `ALLOW_SIGN_UP=false` and redeploy Finance. Signup is then closed for new accounts. CI can use `CI=true`. No shared bootstrap password or repository token is used.

Better Auth owns session cookies and session persistence. Raw session tokens must never be displayed or logged. TOTP/2FA, passkeys, user-visible session listing/revocation and password-change UI are open implementation items. The current HTTP LAN deployment must not be treated as transport-confidential.
