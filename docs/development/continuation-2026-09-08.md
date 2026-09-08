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

## Checkpoint: korekta i voidowanie transakcji — lokalnie zweryfikowane

AGY pozostawił implementację Phase 2 w worktree, ale zakończył się timeoutem oczekiwania na odpowiedź. Manager poprawił wyłącznie fixture’y testowe i zweryfikował kod niezależnie.

- migracja `0004_normal_onslaught.sql` dodaje `version`, `voided_at`, `void_reason` i `submission_id`;
- expense, income i transfer można odczytać oraz korygować; transfer pozostaje jednym logicznym rekordem z dwoma kontami;
- void jest niedestrukcyjny, a domyślna historia wyklucza voided records;
- optimistic concurrency używa warunku household + id + expected version;
- duplikaty `submissionId` są odrzucane przez unikalny indeks per household;
- snapshoty kont nie są modyfikowane przez korektę ani void;
- API i responsywne UI mają szczegóły, korektę i potwierdzenie voidowania w PL/EN.

Weryfikacja Phase 2:

- `pnpm test`: 301 testów passed (domain 66, db 29, web 206);
- `pnpm typecheck`: passed;
- `pnpm lint`: passed;
- `pnpm build`: passed;
- `git diff --check`: passed;
- migracje na izolowanej bazie `nodvis_finance_phase2_test`: pierwsze i drugie `pnpm db:migrate` passed; baza usunięta po teście.

Ograniczenie do dalszego przeglądu: korekty są kontrolowanymi edycjami z wersją, `updatedAt`, `voidedAt` i `voidReason`; nie ma jeszcze osobnej immutable tabeli pełnych rewizji ani identyfikatora osoby wykonującej zmianę.

## Checkpoint: truthful household overview — lokalnie zweryfikowane

Dodano `/api/households/:householdId/overview` i przebudowano stronę główną tak, aby pokazywała rzeczywiste dane wybranego gospodarstwa i okresu:

- income, spending, net cash flow i liczba transakcji per waluta;
- spending by category, w tym uncategorized;
- dostępna gotówka tylko dla aktywów `checking`/`savings`/`cash`, z dokładnym bigint i osobnym wynikiem dla każdej waluty;
- brakujące lub przeterminowane snapshoty są oznaczone jako unknown/partial;
- karty kredytowe, transfery i voided transactions nie zawyżają metryk;
- zakres miesiąca używa jawnych granic UTC i może być sterowany przez `?month=YYYY-MM`;
- dodano lokalizowane, responsywne sekcje overview, ostrzeżenia obserwacji i akcję dodania transakcji.

Weryfikacja Phase 3:

- `pnpm test`: 322 testy passed (domain 78, db 32, web 212);
- `pnpm typecheck`: passed;
- `pnpm lint`: passed;
- `pnpm build`: passed, w tym endpoint overview;
- `git diff --check`: passed.

Overview nie tworzy migracji — używa istniejącego modelu transakcji, kategorii, kont i snapshotów.

## Checkpoint: filtrowanie, paginacja i CSV — lokalnie zweryfikowane

- server-side filtry household-scoped: okres/data range, typ, konto, kategoria, tekst i status;
- stabilna paginacja z sortowaniem occurredOn, createdAt i id;
- URL zachowuje stan filtrów, reset oraz stany pustych wyników;
- CSV bieżącego filtrowania zawiera datę, typ, dokładną kwotę dziesiętną, walutę, konto, kategorię, opis i status;
- eksport używa UTF-8 BOM, RFC 4180 escaping i ochrony przed spreadsheet formula injection;
- PL/EN parity zachowana.

Weryfikacja Phase 4:

- `pnpm test`: 356 testów passed (domain 78, db 42, web 236);
- `pnpm typecheck`: passed;
- `pnpm lint`: passed;
- `pnpm build`: passed, w tym endpoint export;
- `git diff --check`: passed.

E2E Playwright nie został oznaczony jako passed: istniejący `e2e/smoke.spec.ts` sprawdza wycofane marketingowe teksty i nie pokrywa nowych przepływów.

## Deployment prywatny

- backup: `/home/erza_agent/backups/nodvis-finance-private-20260908T095608Z.dump`, 35,685 bajtów; `pg_restore --list` w obrazie PostgreSQL passed;
- `docker compose ... build migrate web` passed;
- migracja prywatna uruchomiona dwukrotnie, oba przebiegi passed;
- web odtworzony przez `up -d --force-recreate web`, bez usuwania volume;
- PostgreSQL i web healthy; LAN `http://192.168.1.119:3000/pl` zwrócił HTTP 200;
- E2E z prawdziwym loginem nie wykonano w tej sesji.

## Quality gate: authenticated browser E2E

- Zaktualizowano `e2e/smoke.spec.ts`, aby sprawdzał aktualną nawigację aplikacji PL/EN zamiast usuniętych tekstów marketingowych.
- Dodano `e2e/finance.spec.ts` z syntetycznym signup/onboardingiem i izolacją per locale.
- Playwright Chromium uruchomiony na jednorazowym projekcie `nodvis-finance-e2e`, osobnym volume PostgreSQL i aplikacji na `127.0.0.1:3100`; prywatny projekt `nodvis-finance-private` nie był modyfikowany.
- PL: 1/1 authenticated flow passed; EN: 1/1 authenticated flow passed.
- Scenariusze sprawdziły w przeglądarce: kategorię, expense/income/transfer, korekty każdego typu, niedestrukcyjne void, overview, filtr tekstowy, paginację oraz link/parametry CSV; odczyt API po reloadzie potwierdził trwałość i zakres household.
- Smoke: 3/3 passed. Łącznie śledzone E2E: 5/5 passed.
- `pnpm test`: 356/356 passed; `pnpm typecheck`, `pnpm lint`, `git diff --check`: passed.
- `pnpm build` pozostaje wymaganym końcowym checkiem przed push.
