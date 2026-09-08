import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import {
  computeFallbackIdentifier,
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
  AmbiguousImportRowCommitError,
  commitStatementImportBatchInDb,
  createStatementImportBatchInDb,
  DuplicateImportRowError,
  findExistingAuthoritativeRecordsInDb,
  findExistingFallbackRecordsInDb,
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

  it.runIf(isPostgresAvailable)(
    "deduplicates authoritative transactions across reordered and overlapping files while linking every import observation",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Auth Dedupe Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: personId,
        displayName: "Auth Person",
      });
      await db.insert(householdMemberships).values({
        householdId,
        personId,
      });
      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "Auth Account",
        type: "checking",
        currency: "PLN",
      });

      const namespace = "revolut";
      const sourceAcc = "rev-001";

      // File 1 has TX-001 and TX-002
      const dedupeHash1 = computeRowDedupeHash({
        accountId,
        sourceNamespace: namespace,
        sourceAccountId: sourceAcc,
        authoritativeId: "TX-001",
      });
      const dedupeHash2 = computeRowDedupeHash({
        accountId,
        sourceNamespace: namespace,
        sourceAccountId: sourceAcc,
        authoritativeId: "TX-002",
      });

      const { batchId: batch1Id } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId,
          sourceFilename: "file1.csv",
          fileHash: "sha256-f1",
          fileSizeBytes: 100,
          parserVersion: "1.0.0",
          sourceNamespace: namespace,
          sourceAccountId: sourceAcc,
          mappingConfig: {} as any,
          status: "preview",
          totalRowCount: 2,
          validRowCount: 2,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 0,
            sourceNamespace: namespace,
            sourceAccountId: sourceAcc,
            authoritativeId: "TX-001",
            identityType: "authoritative",
            dedupeHash: dedupeHash1,
            status: "pending",
            rawRowContent: "2026-03-01,10.00,TX-001",
            normalizedOccurredOn: new Date("2026-03-01T00:00:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 1000n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Shop A",
            normalizedDescription: "Shop A",
          },
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 1,
            sourceNamespace: namespace,
            sourceAccountId: sourceAcc,
            authoritativeId: "TX-002",
            identityType: "authoritative",
            dedupeHash: dedupeHash2,
            status: "pending",
            rawRowContent: "2026-03-02,20.00,TX-002",
            normalizedOccurredOn: new Date("2026-03-02T00:00:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 2000n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Shop B",
            normalizedDescription: "Shop B",
          },
        ],
      });

      // Commit Batch 1 (both rows)
      const commit1 = await commitStatementImportBatchInDb({
        householdId,
        batchId: batch1Id,
        accountId,
        selectedRowIndices: [0, 1],
        personId,
      });
      expect(commit1.importedCount).toBe(2);
      const [tx1Id, tx2Id] = commit1.committedTransactionIds;

      const batch1Rows = await listStatementImportRowsByBatch(householdId, batch1Id);
      expect(batch1Rows[0]?.canonicalTransactionId).toBe(tx1Id);
      expect(batch1Rows[1]?.canonicalTransactionId).toBe(tx2Id);

      // Now File 2 arrives with overlapping/reordered rows:
      // Row 0: TX-002 (already in DB)
      // Row 1: TX-003 (new)
      // Row 2: TX-001 (already in DB)
      const existingAuthRecords = await findExistingAuthoritativeRecordsInDb({
        householdId,
        accountId,
        sourceNamespace: namespace,
        sourceAccountId: sourceAcc,
        authoritativeIds: ["TX-002", "TX-003", "TX-001"],
      });

      expect(existingAuthRecords.has("TX-001")).toBe(true);
      expect(existingAuthRecords.get("TX-001")?.transaction.id).toBe(tx1Id);
      expect(existingAuthRecords.get("TX-001")?.importRow?.id).toBe(batch1Rows[0]?.id);

      expect(existingAuthRecords.has("TX-002")).toBe(true);
      expect(existingAuthRecords.get("TX-002")?.transaction.id).toBe(tx2Id);
      expect(existingAuthRecords.get("TX-002")?.importRow?.id).toBe(batch1Rows[1]?.id);

      expect(existingAuthRecords.has("TX-003")).toBe(false);

      const dedupeHash3 = computeRowDedupeHash({
        accountId,
        sourceNamespace: namespace,
        sourceAccountId: sourceAcc,
        authoritativeId: "TX-003",
      });

      const { batchId: batch2Id } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId,
          sourceFilename: "file2-reordered.csv",
          fileHash: "sha256-f2",
          fileSizeBytes: 150,
          parserVersion: "1.0.0",
          sourceNamespace: namespace,
          sourceAccountId: sourceAcc,
          mappingConfig: {} as any,
          status: "preview",
          totalRowCount: 3,
          validRowCount: 1,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 0,
            sourceNamespace: namespace,
            sourceAccountId: sourceAcc,
            authoritativeId: "TX-002",
            identityType: "authoritative",
            dedupeHash: dedupeHash2,
            status: "duplicate",
            canonicalTransactionId: tx2Id,
            matchedImportRowId: batch1Rows[1]?.id,
            rawRowContent: "2026-03-02,20.00,TX-002",
          },
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 1,
            sourceNamespace: namespace,
            sourceAccountId: sourceAcc,
            authoritativeId: "TX-003",
            identityType: "authoritative",
            dedupeHash: dedupeHash3,
            status: "pending",
            rawRowContent: "2026-03-03,30.00,TX-003",
            normalizedOccurredOn: new Date("2026-03-03T00:00:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 3000n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Shop C",
            normalizedDescription: "Shop C",
          },
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 2,
            sourceNamespace: namespace,
            sourceAccountId: sourceAcc,
            authoritativeId: "TX-001",
            identityType: "authoritative",
            dedupeHash: dedupeHash1,
            status: "duplicate",
            canonicalTransactionId: tx1Id,
            matchedImportRowId: batch1Rows[0]?.id,
            rawRowContent: "2026-03-01,10.00,TX-001",
          },
        ],
      });

      // Commit Batch 2 selecting row 1 only (the new row)
      const commit2 = await commitStatementImportBatchInDb({
        householdId,
        batchId: batch2Id,
        accountId,
        selectedRowIndices: [1],
        personId,
      });

      expect(commit2.importedCount).toBe(1);
      expect(commit2.skippedCount).toBe(2);

      // Verify every import observation is preserved with links in Batch 2
      const batch2Rows = await listStatementImportRowsByBatch(householdId, batch2Id);
      expect(batch2Rows.length).toBe(3);

      // Row 0 preserves link to canonical tx2 and original import row
      expect(batch2Rows[0]?.status).toBe("duplicate");
      expect(batch2Rows[0]?.canonicalTransactionId).toBe(tx2Id);
      expect(batch2Rows[0]?.matchedImportRowId).toBe(batch1Rows[1]?.id);

      // Row 1 was imported with new canonical tx
      expect(batch2Rows[1]?.status).toBe("imported");
      expect(batch2Rows[1]?.canonicalTransactionId).toBe(commit2.committedTransactionIds[0]);

      // Row 2 preserves link to canonical tx1 and original import row
      expect(batch2Rows[2]?.status).toBe("duplicate");
      expect(batch2Rows[2]?.canonicalTransactionId).toBe(tx1Id);
      expect(batch2Rows[2]?.matchedImportRowId).toBe(batch1Rows[0]?.id);
    },
  );

  it.runIf(isPostgresAvailable)(
    "does not collapse two identical legitimate fallback purchases within the same account and day",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Multiple Purchase Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: personId,
        displayName: "Shopper",
      });
      await db.insert(householdMemberships).values({
        householdId,
        personId,
      });
      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "Coffee Card",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 50000n,
        balanceSnapshotAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const dateStr = "2026-03-05";
      const fallbackId = computeFallbackIdentifier({
        occurredOnDate: dateStr,
        amountMinor: 1850n,
        currency: "PLN",
        kind: "expense",
        normalizedDescription: "Corner Cafe",
      });

      const hash0 = computeRowDedupeHash({
        accountId,
        fallbackIdentifier: fallbackId,
        occurrenceIndex: 0,
      });

      const hash1 = computeRowDedupeHash({
        accountId,
        fallbackIdentifier: fallbackId,
        occurrenceIndex: 1,
      });

      expect(hash0).not.toBe(hash1);

      const { batchId } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId,
          sourceFilename: "coffee.csv",
          fileHash: "sha256-coffee",
          fileSizeBytes: 200,
          parserVersion: "1.0.0",
          mappingConfig: {} as any,
          status: "preview",
          totalRowCount: 2,
          validRowCount: 2,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 0,
            fallbackIdentifier: fallbackId,
            occurrenceIndex: 0,
            identityType: "fallback",
            dedupeHash: hash0,
            status: "pending",
            rawRowContent: "2026-03-05,-18.50,Corner Cafe",
            normalizedOccurredOn: new Date("2026-03-05T08:30:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 1850n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Corner Cafe",
            normalizedDescription: "Corner Cafe",
          },
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 1,
            fallbackIdentifier: fallbackId,
            occurrenceIndex: 1,
            identityType: "fallback",
            dedupeHash: hash1,
            status: "pending",
            rawRowContent: "2026-03-05,-18.50,Corner Cafe",
            normalizedOccurredOn: new Date("2026-03-05T14:15:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 1850n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Corner Cafe",
            normalizedDescription: "Corner Cafe",
          },
        ],
      });

      const commitResult = await commitStatementImportBatchInDb({
        householdId,
        batchId,
        accountId,
        selectedRowIndices: [0, 1],
        personId,
      });

      expect(commitResult.importedCount).toBe(2);
      expect(commitResult.committedTransactionIds.length).toBe(2);

      // Verify two distinct transactions exist in transactions table
      const [tx0] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, commitResult.committedTransactionIds[0]!));
      const [tx1] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, commitResult.committedTransactionIds[1]!));

      expect(tx0).toBeDefined();
      expect(tx1).toBeDefined();
      expect(tx0?.id).not.toBe(tx1?.id);
      expect(tx0?.amountMinor).toBe(1850n);
      expect(tx1?.amountMinor).toBe(1850n);

      // Balance snapshot is untouched
      const [acc] = await db.select().from(accounts).where(eq(accounts.id, accountId));
      expect(acc?.balanceSnapshotMinor).toBe(50000n);

      // Query fallback records from DB: should return both occurrences
      const existingRecords = await findExistingFallbackRecordsInDb({
        householdId,
        accountId,
        fallbackIdentifiers: [fallbackId],
      });

      const occurrences = existingRecords.get(fallbackId);
      expect(occurrences?.length).toBe(2);
      expect(occurrences?.[0]?.occurrenceIndex).toBe(0);
      expect(occurrences?.[1]?.occurrenceIndex).toBe(1);
    },
  );

  it.runIf(isPostgresAvailable)(
    "scopes authoritative external references per account so the same ID can exist across two accounts",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const accountAId = crypto.randomUUID();
      const accountBId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Two Accounts Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: personId,
        displayName: "Multi-Account Owner",
      });
      await db.insert(householdMemberships).values({
        householdId,
        personId,
      });
      await db.insert(accounts).values({
        id: accountAId,
        householdId,
        name: "Account A",
        type: "checking",
        currency: "PLN",
      });
      await db.insert(accounts).values({
        id: accountBId,
        householdId,
        name: "Account B",
        type: "savings",
        currency: "PLN",
      });

      const sharedExternalRef = "BANK-REF-99999";
      const namespace = "shared_bank";

      // Commit transaction in Account A with shared external ref
      const { batchId: batchAId } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId: accountAId,
          sourceFilename: "acc-a.csv",
          fileHash: "sha256-a",
          fileSizeBytes: 100,
          parserVersion: "1.0.0",
          sourceNamespace: namespace,
          sourceAccountId: "acc-a-iban",
          mappingConfig: {} as any,
          status: "preview",
          totalRowCount: 1,
          validRowCount: 1,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as any,
            householdId,
            accountId: accountAId,
            rowIndex: 0,
            sourceNamespace: namespace,
            sourceAccountId: "acc-a-iban",
            authoritativeId: sharedExternalRef,
            identityType: "authoritative",
            dedupeHash: computeRowDedupeHash({
              accountId: accountAId,
              sourceNamespace: namespace,
              sourceAccountId: "acc-a-iban",
              authoritativeId: sharedExternalRef,
            }),
            status: "pending",
            rawRowContent: "2026-03-01,-100.00,Shared Ref",
            normalizedOccurredOn: new Date("2026-03-01T00:00:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 10000n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Transfer",
            normalizedDescription: "Shared Ref",
          },
        ],
      });

      await commitStatementImportBatchInDb({
        householdId,
        batchId: batchAId,
        accountId: accountAId,
        selectedRowIndices: [0],
        personId,
      });

      // Commit transaction in Account B with the same external ref
      const { batchId: batchBId } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId: accountBId,
          sourceFilename: "acc-b.csv",
          fileHash: "sha256-b",
          fileSizeBytes: 100,
          parserVersion: "1.0.0",
          sourceNamespace: namespace,
          sourceAccountId: "acc-b-iban",
          mappingConfig: {} as any,
          status: "preview",
          totalRowCount: 1,
          validRowCount: 1,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as any,
            householdId,
            accountId: accountBId,
            rowIndex: 0,
            sourceNamespace: namespace,
            sourceAccountId: "acc-b-iban",
            authoritativeId: sharedExternalRef,
            identityType: "authoritative",
            dedupeHash: computeRowDedupeHash({
              accountId: accountBId,
              sourceNamespace: namespace,
              sourceAccountId: "acc-b-iban",
              authoritativeId: sharedExternalRef,
            }),
            status: "pending",
            rawRowContent: "2026-03-01,100.00,Shared Ref",
            normalizedOccurredOn: new Date("2026-03-01T00:00:00.000Z"),
            normalizedKind: "income",
            normalizedAmountMinor: 10000n,
            normalizedCurrency: "PLN",
            normalizedSource: "Transfer",
            normalizedDescription: "Shared Ref",
          },
        ],
      });

      // Account B commit should succeed without unique constraint collision
      const commitB = await commitStatementImportBatchInDb({
        householdId,
        batchId: batchBId,
        accountId: accountBId,
        selectedRowIndices: [0],
        personId,
      });

      expect(commitB.importedCount).toBe(1);

      // Verify both transactions exist independently
      const txA = await findExistingAuthoritativeRecordsInDb({
        householdId,
        accountId: accountAId,
        sourceNamespace: namespace,
        sourceAccountId: "acc-a-iban",
        authoritativeIds: [sharedExternalRef],
      });
      const txB = await findExistingAuthoritativeRecordsInDb({
        householdId,
        accountId: accountBId,
        sourceNamespace: namespace,
        sourceAccountId: "acc-b-iban",
        authoritativeIds: [sharedExternalRef],
      });

      expect(txA.has(sharedExternalRef)).toBe(true);
      expect(txB.has(sharedExternalRef)).toBe(true);
      expect(txA.get(sharedExternalRef)?.transaction.id).not.toBe(
        txB.get(sharedExternalRef)?.transaction.id,
      );
    },
  );

  it.runIf(isPostgresAvailable)(
    "enforces ambiguity safety by rejecting commitment of ambiguous rows without explicit resolution",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Ambiguity Safety Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: personId,
        displayName: "Safety Tester",
      });
      await db.insert(householdMemberships).values({
        householdId,
        personId,
      });
      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "Safety Checking",
        type: "checking",
        currency: "PLN",
      });

      const { batchId } = await createStatementImportBatchInDb({
        batch: {
          householdId,
          accountId,
          sourceFilename: "ambiguous.csv",
          fileHash: "sha256-ambig",
          fileSizeBytes: 100,
          parserVersion: "1.0.0",
          mappingConfig: {} as any,
          status: "preview",
          totalRowCount: 1,
          validRowCount: 1,
          invalidRowCount: 0,
        },
        rows: [
          {
            batchId: "" as any,
            householdId,
            accountId,
            rowIndex: 0,
            identityType: "fallback",
            ambiguityState: "ambiguous", // Ambiguous state!
            dedupeHash: "dedupe-ambig-1",
            status: "pending",
            rawRowContent: "2026-03-01,-50.00,Store",
            normalizedOccurredOn: new Date("2026-03-01T00:00:00.000Z"),
            normalizedKind: "expense",
            normalizedAmountMinor: 5000n,
            normalizedCurrency: "PLN",
            normalizedPayee: "Store",
            normalizedDescription: "Store",
          },
        ],
      });

      // Attempting to commit ambiguous row without resolution must fail
      await expect(
        commitStatementImportBatchInDb({
          householdId,
          batchId,
          accountId,
          selectedRowIndices: [0],
          personId,
        }),
      ).rejects.toThrow(AmbiguousImportRowCommitError);
    },
  );
});
