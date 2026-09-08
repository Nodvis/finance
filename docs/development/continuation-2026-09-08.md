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

## Checkpoint: generic CSV statement import

- Dodano bounded generic CSV workflow: encoding/delimiter detection, exact signed amounts, date/currency validation, column mapping, preview, invalid-row rejection, explicit commit and deterministic deduplication.
- Dodano provenance: import batch, file hash/metadata, parser version, source row identity, normalized values, row status and linked transaction.
- Imported mutations reuse transaction invariants and append audit history with source `import`; observed balance snapshots are untouched.
- Added PL/EN `/imports` UI reachable from account cards and authorized preview/commit/inspect API endpoints.
- Verification: fresh PostgreSQL migration 0001–0006 applied twice; focused domain/DB/web tests passed; Chromium authenticated PL/EN + smoke passed 5/5 against isolated Compose PostgreSQL; exact minor-unit read-back and same-file re-import dedupe verified.
- Known limitation: generic CSV only; no bank-specific adapters, transfer auto-classification, OCR, bank sync or reconciliation engine.

## Next mission plan: stable import identity first

- Baseline: current import rows use account-scoped `dedupeHash` uniqueness for `status=imported`, source row identity is stored as text, and preview matching uses first same-kind/currency/amount transaction within ±24 hours. This is insufficient for overlapping exports and can collapse legitimate identical transactions.
- P0 identity strategy: preserve canonical transaction UUIDs, add source namespace/provider + source-account identity + authoritative source transaction ID where supplied, keep every import observation/source row, and use conservative fallback candidates with occurrence/ambiguity states rather than global hash uniqueness. Authoritative links may auto-dedupe; ambiguous fallback matches remain reviewable.
- Automatic processing policy: only authoritative or unambiguous deterministic matches auto-process; possible/manual matches, changed source records, voided records, one-sided transfers and unsupported currency cases remain explicit review states.
- UI plan from accessible screenshots: separate public auth from private data; compact authenticated shell; first-class transactions/imports/accounts/analysis navigation; focused forms/drawers; dense but readable filterable transaction list; truthful empty states; responsive account/category workspaces. Screenshots 6–9 are not available as local media files and will be reviewed from the prompt requirements rather than claimed as visually inspected.
- Migration/deployment: additive schema only, fresh disposable PostgreSQL and idempotent migration before private backup/migration; preserve existing provenance/audit and private volume.

## Checkpoint: immutable transaction history — review in progress

- Dodano append-only `transaction_audit_entries` z operacją, źródłem manual/system/import, aktorem auth user/person, rewizją i dokładnymi snapshotami before/after.
- Create, correction i void zapisują mutację oraz audyt atomowo; optimistic concurrency i `submissionId` pozostały aktywne.
- Dodano bazowy stan `legacy` bez fabrykowania starych rewizji oraz autoryzowany endpoint/UI historii zmian w PL/EN.
- Migracja additive: `packages/db/drizzle/0005_careless_richard_fisk.sql`; trigger blokuje UPDATE/DELETE audytu, a FK historii używają `RESTRICT`.
- Świeży PostgreSQL: migracja uruchomiona dwukrotnie; po migracji DB integration audit: 54 testy passed.
- Focused tests: domain 85, db 54, web 248 passed; typecheck i build passed. Pełny quality gate oraz authenticated Chromium E2E historii są jeszcze przed commitem checkpointu.

## Checkpoint: P0 stable source identity — locally verified

- Wdrożono stabilną tożsamość źródłową i linkage obserwacji importowych:
  - Additive schema w `transactions`, `statement_import_batches` i `statement_import_rows`: `sourceNamespace`, `sourceAccountId`, `authoritativeId`, `fallbackIdentifier`, `fallbackEvidence`, `occurrenceIndex`, `identityType`, `ambiguityState`, `canonicalTransactionId`, `matchedImportRowId`.
  - Unikalne indeksy cząstkowe per household + account: `transactions_household_account_authoritative_idx` oraz `statement_import_rows_account_auth_imported_idx`.
  - Wygenerowano i sprawdzono migrację Drizzle `packages/db/drizzle/0007_silent_the_call.sql` (bez używania drizzle-kit push).
  - Deterministyczny hash tożsamości rezerwowej (`computeFallbackIdentifier`) bazujący na niezmiennych faktach operacji (data, exact bigint amount, waluta, rodzaj, znormalizowany opis).
  - Obsługa wielu identycznych zakupów w ramach tego samego pliku lub strumienia: sekwencyjny `occurrenceIndex` (0, 1, 2...) zapobiega kolapsowi identycznych zakupów.
  - Zakresowanie tego samego ID autorytatywnego (external reference) do konkretnego konta: dwa konta w tym samym gospodarstwie mogą posiadać identyczny identyfikator zewnętrzny bez kolizji unikalności.
  - Reordered/overlapping files dedupe: autorytatywne ID dopasowują istniejące rekordy i wiążą nową obserwację z pierwotną transakcją kanoniczną (`canonicalTransactionId`) oraz wierszem importu (`matchedImportRowId`).
  - Bezpieczeństwo i konserwatywna ochrona: wiersze dopasowujące transakcje voided lub posiadające niejednoznaczności otrzymują `ambiguityState = 'ambiguous'`, co blokuje ich automatyczny zapis i wymaga jawnego przeglądu (`AmbiguousImportRowCommitError`).
  - Zachowano pełną zgodność z importerem generycznym CSV, audytem transakcji (`source = 'import'`) i nienaruszalnością snapshotów sald.
- Focused test results:
  - `packages/domain`: 114/114 passed (w tym 7 test suites).
  - `packages/db` integration: `statement-imports.test.ts` (6/6 passed), `transactions.test.ts` (27/27 passed), `audit-immutability.test.ts` (3/3 passed).
  - `apps/web`: `service.test.ts` (10/10 passed), `route.test.ts` (9/9 passed).
  - Independent review correction: `sourceRowIdentityColumn` is never promoted to authoritative identity; source-row value remains provenance. Empty legacy source defaults are omitted from hydrated domain transactions.
  - Independent verification: full `pnpm test` passed (domain 114, DB 60, web 267), `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`, and PostgreSQL temporary expression-index syntax check passed.
