# Overnight product delivery — 2026-09-07

## Baseline

- Branch: `feature/phase1-transactions-domain`
- Baseline HEAD: `54123fe2288eafdfc5e29f2b2b8c61ec5bcd6ece` (`feat: polish bilingual finance interface`)
- `origin/main`: `4f41a28` (`merge: complete phase 1a financial foundation`)
- Remote repository verified private: `https://github.com/Nodvis/finance.git`
- Remote feature branch did not exist at start; it will be published without rewriting history.
- Preserved untracked files reviewed: `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, `e2e/auth-temp.spec.ts`. The E2E file contains local synthetic credentials and remains untracked.

## Baseline verification

Using Node `v24.20.0` and pnpm `11.24.0`:

- `pnpm install --frozen-lockfile` — passed
- `pnpm typecheck` — passed
- `pnpm test` — passed: domain 40, db 18, web 93 tests
- `pnpm lint` — passed (repository lint script currently runs type generation/typecheck)
- `pnpm build` — passed

## Scope and checkpoints

Priority scope is a secure onboarding/accounts vertical slice, followed by the highest-value transaction-history/dashboard/filtering work that can be completed and verified safely. Each verified slice is recorded below.

### Completed

- Baseline inspected and verified; baseline checkpoint `d7ea18f` published to the feature branch.
- `f3540b9` — authenticated first-use household onboarding, multi-household selection, account list/create/edit/archive/restore UI and localized PL/EN messages.
- `a41c8cb` — registered reviewed `archived_at` migration metadata.
- Onboarding/account tests, authorization tests, translation parity, typecheck, lint, build and full workspace tests passed.
- Private Compose migration applied successfully using the committed migration after a verified backup. Backup: `/tmp/nodvis-finance-private-20260907-214115.dump` (35,507 bytes; `pg_restore -l` verified in a PostgreSQL 18 container).
- Private web image rebuilt and force-recreated. PostgreSQL and web healthchecks passed; `http://192.168.1.119:3000/pl` returned HTTP 200.
- Authenticated Playwright smoke against the private LAN deployment passed: sign-in with the existing synthetic development account, current-household lookup, account API, `/pl`, and `/pl/accounts`.

### Deferred / not yet verified

- Categories, transaction correction, truthful period overview metrics, server-side history filtering/pagination, CSV export and full bilingual browser acceptance for those features.
- New-user sign-up was not added; onboarding starts after the existing supported Better Auth sign-in.
- The preserved `e2e/auth-temp.spec.ts` remains untracked because it contains temporary synthetic credentials and a hardcoded legacy household id.
- Final PR/merge decision.

## Notes

No secrets, `.env` files, database dumps or real financial exports are intended for Git. The private Compose database must be backed up before any migration/deployment operation.
