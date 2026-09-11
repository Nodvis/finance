# Contributing to Nodvis Finance

Nodvis Finance is currently a public, self-hosted household finance application. Contributions should prioritize domain correctness, security and clear product behavior over speed or feature count.

## Before making a change

Read:

- `README.md`
- `AGENTS.md`
- `docs/product.md`
- `docs/domain.md`
- `docs/mvp.md`
- relevant ADRs in `docs/adr/`

## Design-first rule

If a change affects any of the following, document the decision before or with implementation:

- financial semantics,
- authentication,
- storage/encryption,
- deployment,
- import behavior,
- backup/restore,
- cross-product integration,
- external services/AI.

Material architectural decisions require an ADR.

## Financial correctness

Changes must preserve the invariants in `docs/domain.md`.

When implementation begins, behavior affecting transfers, cash, credit cards, obligations, liabilities, reimbursements, imports or forecasts should include tests demonstrating the relevant invariant.

## Security

Never commit:

- credentials or secrets,
- real bank statements,
- real financial documents,
- unredacted personal exports,
- encryption keys.

Use synthetic fixtures.

See `SECURITY.md` for repository security rules.

## Internationalization

Polish and English are supported from the beginning. New user-facing copy must use the project's i18n mechanism (`next-intl`).

### Adding a new locale process

To add a new language/locale to the application:

1. **Central configuration**:
   Register the new locale code in `apps/web/src/i18n/config.ts` by adding it to `LOCALES` and providing display names, decimal separator, and grouping configuration in `LOCALE_CONFIGS`.
2. **Message catalog**:
   Create `apps/web/messages/<locale>.json` by duplicating an existing catalog and translating all strings.
3. **Parity and validation verification**:
   Run `pnpm --filter @nodvis/finance-web test src/i18n/localization.test.ts` to ensure 100% leaf key parity and non-empty translation strings.
4. **Natural number and currency check**:
   Ensure natural decimal entry and locale formatting follow native conventions for that locale without technical minor-unit jargon.

### Translation definition-of-done

A translation or localization change is considered done when:

- [ ] Complete 100% key parity with all other supported message catalogs (`pl.json`, `en.json`).
- [ ] All translated values are non-empty and naturally phrased for household users.
- [ ] No technical minor-unit labels, internal database column names, or raw schema jargon are visible to users.
- [ ] Decimal amount entry supports both native separators (comma / dot) and converts via exact `BigInt` minor units without floating-point `Number` coercion.
- [ ] Accessibility labels (`aria-label`, `aria-describedby`, landmark roles, skip links) are localized and screen-reader tested.
- [ ] Automated parity and component tests pass via `pnpm test`.

## Scope

Check `ROADMAP.md` and `docs/mvp.md` before expanding scope. Direct bank sync, mandatory AI, public cloud and Recall integration are intentionally later concerns unless explicitly promoted by a new decision.

## Commit style

Prefer concise Conventional Commit-style messages, for example:

```text
feat: add manual transaction flow
fix: prevent transfer from counting as income
refactor: isolate import normalization
security: harden uploaded file validation
docs: record authentication ADR
test: cover credit card repayment invariant
```

## Pull requests

Keep changes focused and explain:

- what problem is solved,
- what domain/security assumptions are affected,
- which tests validate financial behavior,
- whether documentation or ADRs changed.

Avoid unrelated refactors in the same change.
