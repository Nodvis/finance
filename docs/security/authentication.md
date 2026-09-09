# Authentication and sessions

Better Auth 1.7.2 is the sole authentication system. Email/password hashing and verification remain inside Better Auth's reviewed implementation; Nodvis does not read or print password hashes. The configured password length is 12–128 characters, with no arbitrary composition rule.

Private deployment signup is closed by default through `ALLOW_SIGN_UP=false`. A controlled bootstrap may temporarily set it to `true`; the value must be reverted and the web service restarted. CI can use `CI=true`. No shared bootstrap password or repository token is used.

Better Auth owns session cookies and session persistence. Raw session tokens must never be displayed or logged. TOTP/2FA, passkeys, user-visible session listing/revocation and password-change UI are open implementation items. The current HTTP LAN deployment must not be treated as transport-confidential.
