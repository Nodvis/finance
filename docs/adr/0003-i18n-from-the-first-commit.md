# ADR-0003: Internationalization from the first commit

- Status: Accepted
- Date: 2026-08-31

## Context

Polish is the first real usage language, but Nodvis Finance is intended to support both Polish and international users. Retrofitting internationalization after UI and domain formatting are deeply embedded would create unnecessary rework and bugs around dates, decimals and currency.

## Decision

Polish (`pl`) and English (`en`) are architecture-level requirements from the first application scaffold.

The implementation must provide:

- translation keys for user-facing strings,
- locale-aware date formatting,
- locale-aware number formatting,
- locale-aware currency formatting,
- no scattered hardcoded UI strings.

## Consequences

### Positive

- international support does not require a later rewrite,
- Polish formatting is handled correctly from the start,
- UI components are forced to separate copy from logic,
- tests can include multiple locales early.

### Negative / trade-offs

- slightly more setup before visible product work,
- contributors must maintain translation keys,
- layouts must tolerate different label lengths.

## Alternatives considered

### Polish-only first, i18n later

Rejected because internationalization affects architecture and formatting semantics, not only translation copy.

### English-only internal UI first

Rejected because Polish is the first real usage language and should not be treated as a later localization layer.

## Follow-up

The technology-stack ADR should identify the concrete i18n mechanism/library and locale handling strategy.
