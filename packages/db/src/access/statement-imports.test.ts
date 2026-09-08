import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import {
  computeRowDedupeHash,
  money,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import {
  accounts,
  authUsers,
  householdMemberships,
  households,
  persons,
  statementImportBatches,
  statementImportRows,
  transactionAuditEntries,
  transactions,
} from "../schema/index";
import {
  commitStatementImportBatchInDb,
  createStatementImportBatchInDb,
  DuplicateImportRowError,
  findExistingImportDedupeHashes,
  findPossibleManualMatchesInDb,
  findStatementImportBatchById,
  ImportBatchAlreadyCommittedError,
  listStatementImportRowsByBatch,
} from "./statement-imports";
import { eq } from "drizzle-orm";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

describe("PostgreSQL statement import access integration tests", () => {
  const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

  it.runIf(isPostgresAvailable)(
    "creates an import batch and rows, commits valid rows atomically with audit source 'import', and preserves balance snapshots",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const accountId = crypto.randomUUID();
      const authUserId = crypto.randomUUID();

      await db.insert(authUsers).values({
        id: authUserId,
        name: "Importing User",
        email: `import-${Date.now()}@example.test`,
      });

      await db.insert(households).values({
        id: householdId,
        name: "Import Test Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: personId,
        displayName: "Importing Person",
      });
      await db.insert(householdMemberships).values({
        householdId,
        personId,
      });

      const initialSnapshotTime = new Date("2026-01-01T00:00:00.000Z");
      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "Test Checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 100000n,
        balanceSnapshotAt: initialSnapshotTime,
      });

      const dedupeHash1 = computeRowDedupeHash({
        accountId,
        occurredOnDate: "2026-03-01",
        amountMinor: 2550n,
        currency: "PLN",
        kind: "expense",
        normalizedDescription: "Bookstore",
        occurrenceIndex: 0,
      });

      const dedupeHash2 = computeRowDedupeHash({
        accountId,
        occurredOnDate: "2026-03-02",
        amountMinor: 50000n,
        currency: "PLN",
        kind: "income",
        normalizedDescription: "Salary",
        occurrenceIndex: 0,
      });

      const { batchId } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId,
          sourceFilename: "test-statement.csv",
          fileHash: "sha256-test-hash",
          fileSizeBytes: 1024,
          parserVersion: "1.0.0",
          mappingConfig: {
            dateColumn: "date",
            dateFormat: "YYYY-MM-DD",
            timezone: "UTC",
            amountMode: "signed",
            amountColumn: "amount",
            currencyMode: "account",
            descriptionColumn: "desc",
            delimiter: ",",
            hasHeader: true,
            headerRowIndex: 0,
            skipLeadingRows: 0,
          },
          status: "preview",
          totalRowCount: 2,
          validRowCount: 2,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as unknown as string, // will be set by createStatementImportBatchInDb
            householdId,
            accountId,
            rowIndex: 0,
            dedupeHash: dedupeHash1,
            status: "pending",
            rawRowContent: "2026-03-01,-25.50,Bookstore",
            normalizedOccurredOn: new Date("2026-03-01T00:00:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 2550n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Bookstore",
            normalizedDescription: "Bookstore",
          },
          {
            batchId: "" as unknown as string,
            householdId,
            accountId,
            rowIndex: 1,
            dedupeHash: dedupeHash2,
            status: "pending",
            rawRowContent: "2026-03-02,500.00,Salary",
            normalizedOccurredOn: new Date("2026-03-02T00:00:00.000Z"),
            normalizedKind: "income",
            normalizedAmountMinor: 50000n,
            normalizedCurrency: "PLN",
            normalizedSource: "Salary",
            normalizedDescription: "Salary",
          },
        ],
      });

      expect(batchId).toBeDefined();

      const fetchedBatch = await findStatementImportBatchById(householdId, batchId);
      expect(fetchedBatch?.status).toBe("preview");

      const rows = await listStatementImportRowsByBatch(householdId, batchId);
      expect(rows.length).toBe(2);

      // Commit only row 0 (Bookstore)
      const commitResult = await commitStatementImportBatchInDb({
        householdId,
        batchId,
        accountId,
        selectedRowIndices: [0],
        authUserId,
        personId,
      });

      expect(commitResult.importedCount).toBe(1);
      expect(commitResult.skippedCount).toBe(1);
      expect(commitResult.committedTransactionIds.length).toBe(1);

      // Check committed transaction
      const committedTxId = commitResult.committedTransactionIds[0]!;
      const [txInDb] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, committedTxId));
      expect(txInDb).toBeDefined();
      expect(txInDb?.kind).toBe("expense");
      expect(txInDb?.amountMinor).toBe(2550n);
      expect(txInDb?.payee).toBe("Bookstore");

      // Check audit entry has source "import"
      const [auditEntry] = await db
        .select()
        .from(transactionAuditEntries)
        .where(eq(transactionAuditEntries.transactionId, committedTxId));
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.source).toBe("import");
      expect(auditEntry?.operation).toBe("create");

      // Verify balance snapshot on account was NOT mutated!
      const [accountInDb] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));
      expect(accountInDb?.balanceSnapshotMinor).toBe(100000n);
      expect(accountInDb?.balanceSnapshotAt?.toISOString()).toBe(
        initialSnapshotTime.toISOString(),
      );

      // Verify DB uniqueness: attempting to import row with same dedupeHash for same account fails
      const { batchId: batch2Id } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId,
          sourceFilename: "duplicate-statement.csv",
          fileHash: "sha256-duplicate-hash",
          fileSizeBytes: 512,
          parserVersion: "1.0.0",
          mappingConfig: {
            dateColumn: "date",
            dateFormat: "YYYY-MM-DD",
            timezone: "UTC",
            amountMode: "signed",
            amountColumn: "amount",
            currencyMode: "account",
            descriptionColumn: "desc",
            delimiter: ",",
            hasHeader: true,
            headerRowIndex: 0,
            skipLeadingRows: 0,
          },
          status: "preview",
          totalRowCount: 1,
          validRowCount: 1,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as unknown as string,
            householdId,
            accountId,
            rowIndex: 0,
            dedupeHash: dedupeHash1, // Same dedupeHash as already committed Bookstore
            status: "pending",
            rawRowContent: "2026-03-01,-25.50,Bookstore",
            normalizedOccurredOn: new Date("2026-03-01T00:00:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 2550n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Bookstore",
            normalizedDescription: "Bookstore",
          },
        ],
      });

      // Checking existing dedupe hashes detects dedupeHash1
      const existing = await findExistingImportDedupeHashes(accountId, [dedupeHash1]);
      expect(existing.has(dedupeHash1)).toBe(true);

      // Attempting to commit row 0 should fail with DuplicateImportRowError due to DB unique index
      await expect(
        commitStatementImportBatchInDb({
          householdId,
          batchId: batch2Id,
          accountId,
          selectedRowIndices: [0],
          authUserId,
          personId,
        }),
      ).rejects.toThrow(DuplicateImportRowError);

      // Attempting to commit batch 1 again should fail with ImportBatchAlreadyCommittedError
      await expect(
        commitStatementImportBatchInDb({
          householdId,
          batchId,
          accountId,
          selectedRowIndices: [0],
          authUserId,
          personId,
        }),
      ).rejects.toThrow(ImportBatchAlreadyCommittedError);
    },
  );

  it.runIf(isPostgresAvailable)(
    "finds possible manual matches based on date, amount, currency, and kind",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Match Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: personId,
        displayName: "Matching Person",
      });
      await db.insert(householdMemberships).values({
        householdId,
        personId,
      });
      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "Match Checking",
        type: "checking",
        currency: "PLN",
      });

      // Insert an existing manual transaction
      const manualTxId = crypto.randomUUID();
      const occurredOn = new Date("2026-03-10T12:00:00.000Z");
      await db.insert(transactions).values({
        id: manualTxId,
        householdId,
        accountId,
        kind: "expense",
        amountMinor: 8999n,
        currency: "PLN",
        payee: "Pharmacy Manual",
        paidByPersonId: personId,
        occurredOn,
        version: 1,
      });

      const matches = await findPossibleManualMatchesInDb({
        householdId,
        accountId,
        candidates: [
          {
            rowIndex: 0,
            occurredOn: new Date("2026-03-10T00:00:00.000Z"),
            amountMinor: 8999n,
            currency: "PLN",
            kind: "expense",
          },
          {
            rowIndex: 1,
            occurredOn: new Date("2026-03-15T00:00:00.000Z"),
            amountMinor: 12000n,
            currency: "PLN",
            kind: "expense",
          },
        ],
      });

      expect(matches.has(0)).toBe(true);
      expect(matches.get(0)?.transactionId).toBe(manualTxId);
      expect(matches.get(0)?.description).toBe("Pharmacy Manual");
      expect(matches.has(1)).toBe(false);
    },
  );
});
