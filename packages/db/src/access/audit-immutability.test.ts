import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  accountId,
  correctExpense,
  correctTransfer,
  createExpense,
  createTransfer,
  money,
  personId,
  transactionId,
} from "@nodvis/finance-domain";
import type { TransferTransaction } from "@nodvis/finance-domain";

import { getDb } from "../client";
import {
  households,
  persons,
  householdMemberships,
  accounts,
} from "../schema/index";
import {
  insertTransaction,
  updateTransactionInDb,
  voidTransactionInDb,
  listTransactionAuditEntries,
  DuplicateSubmissionError,
  TransactionVersionConflictError,
} from "./transactions";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

describe("PostgreSQL audit immutability and atomic mutation integration tests", () => {
  const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

  it.runIf(isPostgresAvailable)(
    "verifies database-level trigger prevents UPDATE and DELETE on transaction_audit_entries",
    async () => {
      const db = getDb();
      const testHouseholdId = crypto.randomUUID();
      const testPersonId = crypto.randomUUID();
      const testAccountId = crypto.randomUUID();
      const testTxId = crypto.randomUUID();

      await db.insert(households).values({
        id: testHouseholdId,
        name: "Audit Test Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: testPersonId,
        displayName: "Audited Person",
      });
      await db.insert(householdMemberships).values({
        householdId: testHouseholdId,
        personId: testPersonId,
      });
      await db.insert(accounts).values({
        id: testAccountId,
        householdId: testHouseholdId,
        name: "Audit Checking",
        type: "checking",
        currency: "PLN",
      });

      // 1. Create a transaction using insertTransaction (records revision 1)
      const tx = createExpense({
        id: transactionId(testTxId),
        householdId: testHouseholdId as any,
        accountId: accountId(testAccountId),
        amount: money(10000n, "PLN"),
        payee: "Audit Merchant",
        paidByPersonId: personId(testPersonId),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });

      const created = await insertTransaction(tx, {
        audit: {
          authUserId: null,
          personId: testPersonId,
          source: "manual",
        },
      });
      expect(created.version).toBe(1);

      // Verify audit entry exists
      const entries = await listTransactionAuditEntries(testHouseholdId, testTxId);
      expect(entries).toHaveLength(1);
      const auditEntryId = entries[0]!.id;

      // 2. Attempt UPDATE on transaction_audit_entries -> MUST FAIL via trigger
      let updateError: any;
      try {
        await db.execute(
          sql`UPDATE finance.transaction_audit_entries SET void_reason = 'tampered' WHERE id = ${auditEntryId}`,
        );
      } catch (err: any) {
        updateError = err;
      }
      expect(updateError).toBeDefined();
      const updateMsg = `${updateError.message} ${updateError.cause?.message ?? ""}`;
      expect(updateMsg).toMatch(/immutable and cannot be updated or deleted/);

      // 3. Attempt DELETE on transaction_audit_entries -> MUST FAIL via trigger
      let deleteError: any;
      try {
        await db.execute(
          sql`DELETE FROM finance.transaction_audit_entries WHERE id = ${auditEntryId}`,
        );
      } catch (err: any) {
        deleteError = err;
      }
      expect(deleteError).toBeDefined();
      const deleteMsg = `${deleteError.message} ${deleteError.cause?.message ?? ""}`;
      expect(deleteMsg).toMatch(/immutable and cannot be updated or deleted/);

      // 4. Verify the entry was NOT modified or deleted
      const postTamperEntries = await listTransactionAuditEntries(
        testHouseholdId,
        testTxId,
      );
      expect(postTamperEntries).toHaveLength(1);
      expect(postTamperEntries[0]!.voidReason).toBeNull();
    },
  );

  it.runIf(isPostgresAvailable)(
    "verifies full audit lifecycle: create, two corrections, void with exact bigint amounts and transfer state",
    async () => {
      const db = getDb();
      const testHouseholdId = crypto.randomUUID();
      const testPersonId = crypto.randomUUID();
      const testAcc1 = crypto.randomUUID();
      const testAcc2 = crypto.randomUUID();
      const testTxId = crypto.randomUUID();

      await db.insert(households).values({
        id: testHouseholdId,
        name: "Lifecycle Test Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: testPersonId,
        displayName: "Lifecycle Person",
      });
      await db.insert(householdMemberships).values({
        householdId: testHouseholdId,
        personId: testPersonId,
      });
      await db.insert(accounts).values([
        {
          id: testAcc1,
          householdId: testHouseholdId,
          name: "Checking",
          type: "checking",
          currency: "PLN",
        },
        {
          id: testAcc2,
          householdId: testHouseholdId,
          name: "Savings",
          type: "savings",
          currency: "PLN",
        },
      ]);

      // 1. Create transfer with exact large bigint amount
      const hugeAmount = 9007199254740991n; // 2^53 - 1
      const initialTx = createTransfer({
        id: transactionId(testTxId),
        householdId: testHouseholdId as any,
        fromAccountId: accountId(testAcc1),
        toAccountId: accountId(testAcc2),
        amount: money(hugeAmount, "PLN"),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });

      const txV1 = await insertTransaction(initialTx, {
        audit: { authUserId: null, personId: testPersonId, source: "manual" },
      });
      expect(txV1.version).toBe(1);

      // 2. Correction 1: change amount
      const txV2Corrected = correctTransfer(txV1 as TransferTransaction, {
        fromAccountId: accountId(testAcc1),
        toAccountId: accountId(testAcc2),
        amount: money(hugeAmount + 1000n, "PLN"),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });

      const txV2 = await updateTransactionInDb({
        householdId: testHouseholdId,
        id: testTxId,
        expectedVersion: 1,
        transaction: txV2Corrected,
        audit: { authUserId: null, personId: testPersonId, source: "manual" },
      });
      expect(txV2.version).toBe(2);

      // 3. Correction 2: change occurredOn
      const txV3Corrected = correctTransfer(txV2 as TransferTransaction, {
        fromAccountId: accountId(testAcc1),
        toAccountId: accountId(testAcc2),
        amount: money(hugeAmount + 1000n, "PLN"),
        occurredOn: new Date("2026-09-08T12:00:00Z"),
      });

      const txV3 = await updateTransactionInDb({
        householdId: testHouseholdId,
        id: testTxId,
        expectedVersion: 2,
        transaction: txV3Corrected,
        audit: { authUserId: null, personId: testPersonId, source: "manual" },
      });
      expect(txV3.version).toBe(3);

      // 4. Void transaction
      const txV4 = await voidTransactionInDb({
        householdId: testHouseholdId,
        id: testTxId,
        expectedVersion: 3,
        voidReason: "Transfer reversed by bank",
        audit: { authUserId: null, personId: testPersonId, source: "manual" },
      });
      expect(txV4.version).toBe(4);
      expect(txV4.voidedAt).toBeDefined();
      expect(txV4.voidReason).toBe("Transfer reversed by bank");

      // Verify all 4 audit revisions
      const auditRows = await listTransactionAuditEntries(testHouseholdId, testTxId);
      expect(auditRows).toHaveLength(4);

      expect(auditRows[0]!.revision).toBe(1);
      expect(auditRows[0]!.operation).toBe("create");
      expect(auditRows[0]!.beforeState).toBeNull();
      expect(auditRows[0]!.afterState.amountMinor).toBe(hugeAmount.toString());
      expect(auditRows[0]!.afterState.fromAccountId).toBe(testAcc1);
      expect(auditRows[0]!.afterState.toAccountId).toBe(testAcc2);

      expect(auditRows[1]!.revision).toBe(2);
      expect(auditRows[1]!.operation).toBe("correction");
      expect(auditRows[1]!.beforeState?.amountMinor).toBe(hugeAmount.toString());
      expect(auditRows[1]!.afterState.amountMinor).toBe((hugeAmount + 1000n).toString());

      expect(auditRows[2]!.revision).toBe(3);
      expect(auditRows[2]!.operation).toBe("correction");
      expect(auditRows[2]!.afterState.version).toBe(3);

      expect(auditRows[3]!.revision).toBe(4);
      expect(auditRows[3]!.operation).toBe("void");
      expect(auditRows[3]!.voidReason).toBe("Transfer reversed by bank");
      expect(auditRows[3]!.afterState.voidedAt).toBeDefined();
      expect(auditRows[3]!.afterState.voidReason).toBe("Transfer reversed by bank");
    },
  );

  it.runIf(isPostgresAvailable)(
    "verifies duplicate submission and optimistic concurrency error handling on PostgreSQL",
    async () => {
      const db = getDb();
      const testHouseholdId = crypto.randomUUID();
      const testPersonId = crypto.randomUUID();
      const testAcc1 = crypto.randomUUID();
      const testTxId1 = crypto.randomUUID();
      const testTxId2 = crypto.randomUUID();

      await db.insert(households).values({
        id: testHouseholdId,
        name: "Concurrency Test Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: testPersonId,
        displayName: "Concurrency Person",
      });
      await db.insert(householdMemberships).values({
        householdId: testHouseholdId,
        personId: testPersonId,
      });
      await db.insert(accounts).values({
        id: testAcc1,
        householdId: testHouseholdId,
        name: "Checking",
        type: "checking",
        currency: "PLN",
      });

      const tx1 = createExpense({
        id: transactionId(testTxId1),
        householdId: testHouseholdId as any,
        accountId: accountId(testAcc1),
        amount: money(2000n, "PLN"),
        payee: "Merchant 1",
        paidByPersonId: personId(testPersonId),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });

      // Insert first with submission_id = "idem-test-1"
      await insertTransaction(tx1, {
        submissionId: "idem-test-1",
        audit: { authUserId: null, personId: testPersonId, source: "manual" },
      });

      // Attempt duplicate submission with same submission_id
      const tx2 = createExpense({
        id: transactionId(testTxId2),
        householdId: testHouseholdId as any,
        accountId: accountId(testAcc1),
        amount: money(3000n, "PLN"),
        payee: "Merchant 2",
        paidByPersonId: personId(testPersonId),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });

      await expect(
        insertTransaction(tx2, {
          submissionId: "idem-test-1",
          audit: { authUserId: null, personId: testPersonId, source: "manual" },
        }),
      ).rejects.toThrow(DuplicateSubmissionError);

      // Verify no audit row was created for tx2
      const tx2Audit = await listTransactionAuditEntries(testHouseholdId, testTxId2);
      expect(tx2Audit).toHaveLength(0);

      // Attempt update with wrong expectedVersion -> concurrency conflict
      const correctedTx1 = correctExpense(tx1, {
        accountId: accountId(testAcc1),
        amount: money(2500n, "PLN"),
        payee: "Merchant 1 Corrected",
        paidByPersonId: personId(testPersonId),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });

      await expect(
        updateTransactionInDb({
          householdId: testHouseholdId,
          id: testTxId1,
          expectedVersion: 999, // stale expected version
          transaction: correctedTx1,
        }),
      ).rejects.toThrow(TransactionVersionConflictError);

      // Verify audit trail for tx1 still has only 1 entry
      const tx1Audit = await listTransactionAuditEntries(testHouseholdId, testTxId1);
      expect(tx1Audit).toHaveLength(1);
    },
  );
});
