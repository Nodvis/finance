# Kontynuacja dostawy — 2026-09-08

## Baseline

- Zweryfikowany `origin/main`: `65c6ca2584c52b07bd5d4090e206eb165b99f125`.
- Poprzednie merge commit `4aaf7e8` i `65c6ca2` są przodkami `origin/main`.
- Utworzono branch `feature/continuation-categories-transactions`.
- Zachowano untracked `apps/web/AGENTS.md`, `apps/web/CLAUDE.md` i `e2e/auth-temp.spec.ts`; nie są częścią checkpointu.
- Pinned toolchain użyty do weryfikacji: Node `v24.20.0`, pnpm `11.24.0`.
- Baseline przed zmianami: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — przechodziły.

## Checkpoint: kategorie i kategoryzacja

Implementację zlecono AGY na modelu `gemini-3.8-flash-high`. Worker pozostawił zmiany w worktree, ale zakończył się timeoutem oczekiwania na odpowiedź; wynik został niezależnie zweryfikowany.

Zakres:

- household-scoped categories z nazwą, zastosowaniem expense/income/both i archiwizacją;
- defaultowy zestaw kategorii PL, bez przypisywania kategorii do istniejących transakcji;
- reviewed migration `packages/db/drizzle/0003_condemned_dorian_gray.sql`;
- kategoria opcjonalna dla expense/income, zabroniona dla transferu;
- autoryzacja po household na API i serwisach;
- UI `/pl/categories` i `/en/categories`, tworzenie, zmiana nazwy, archive/restore;
- lokalizacje PL/EN i wybór kategorii w formularzu transakcji;
- testy domeny, DB, API, serwisów, strony i parity.

Weryfikacja:

- `pnpm test`: 248 testów passed łącznie (domain 56, db 26, web 166; liczba plików testowych była raportowana przez Vitest).
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; build zawiera `/categories` oraz endpointy categories.
- `git diff --check`: passed.
- Migracje na izolowanej bazie `nodvis_finance_categories_test`: pierwsze `pnpm db:migrate` passed, drugie idempotentne `pnpm db:migrate` passed; baza usunięta po teście. Prywatny Compose volume nie był modyfikowany.

## Następne kroki

- Niezależny przegląd i checkpoint kategorii przed push.
- Następnie korekty/voidowanie transakcji, prawdziwy overview, a potem filtrowanie/paginacja/CSV.
- Prywatna migracja wymaga osobnego backupu przed zastosowaniem i deploymentu po zakończeniu bezpiecznego checkpointu.
