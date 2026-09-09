# Production security checklist

| ASVS area | Status | Evidence / gap |
|---|---|---|
| V1 architecture | PARTIAL | `docs/security/security-architecture.md`; threat model updated; no formal certification |
| V2 authentication | PARTIAL | Better Auth, scrypt implementation, password policy; TOTP/reset hardening remains |
| V3 session management | PARTIAL | Better Auth sessions/cookies; session UI/revocation evidence remains |
| V4 access control | PARTIAL | Server household authorization and existing negative tests; full resource matrix remains |
| V5 validation | PARTIAL | Zod/domain boundaries; import size/formula-injection audit remains |
| V6 cryptography | OPEN | No field encryption or encrypted backup workflow yet |
| V7 errors/logging | PARTIAL | safe route responses in several paths; centralized redacted security events remain |
| V8 data protection | PARTIAL | no external telemetry, private API cache headers; DB/backups remain sensitive |
| V9 communications | PARTIAL | origin checks and browser headers; current deployment is HTTP |
| V10 malicious code | PARTIAL | pinned package manager/runtime policy; dependency/SBOM scan remains |
| V11 business logic | PARTIAL | financial invariant tests and retry protection; repayment/BNPL scope remains |
| V12 files/resources | OPEN | import hardening and safe CSV export require dedicated verification |
| V13 API | PARTIAL | auth/household boundaries and Origin checks; exhaustive BOLA/CSRF matrix remains |
| V14 configuration | PARTIAL | private signup default and hardened web container; DB role separation remains |

This is an engineering status matrix, not an ASVS attestation.
