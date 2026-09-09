import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import {
  accountId,
  createExpense,
  createLiability,
  createLiabilityRepayment,
  createTransfer,
  householdId,
  liabilityId,
  liabilityRepaymentId,
  money,
  personId,
  transactionId,
} from "@nodvis/finance-domain";
import { getDb } from "../client";
import {
  accounts,
  householdMemberships,
  households,
  persons,
} from "../schema/foundation";
import {
  transactionAuditEntries,
  transactions,
} from "../schema/transactions";
import {
  LiabilityDestinationAccountCurrencyMismatchError,
  LiabilityDestinationAccountNotFoundError,
  LiabilityNotFoundError,
  LiabilityRepaymentAlreadyVoidedError,
  LiabilityRepaymentNotFoundError,
  LiabilityRepaymentVersionConflictError,
  LiabilityVersionConflictError,
  archiveLiabilityInDb,
  findLiabilityById,
  findLiabilityRepaymentById,
  insertLiabilityInDb,
  listLiabilitiesByHousehold,
  listLiabilityRepaymentsByHousehold,
  recordLiabilityRepaymentInDb,
  unarchiveLiabilityInDb,
  updateLiabilityInDb,
  voidLiabilityRepaymentInDb,
} from "./liabilities";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

describe("liabilities database access integration", () => {
  const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

  it("exports specific error classes", () => {
    expect(new LiabilityNotFoundError()).toBeInstanceOf(Error);
    expect(new LiabilityVersionConflictError()).toBeInstanceOf(Error);
    expect(new LiabilityDestinationAccountNotFoundError()).toBeInstanceOf(Error);
    expect(new LiabilityDestinationAccountCurrencyMismatchError()).toBeInstanceOf(Error);
    expect(new LiabilityRepaymentNotFoundError()).toBeInstanceOf(Error);
    expect(new LiabilityRepaymentAlreadyVoidedError()).toBeInstanceOf(Error);
    expect(new LiabilityRepaymentVersionConflictError()).toBeInstanceOf(Error);
  });

  it.runIf(isPostgresAvailable)(
    "preserves exact money beyond Number.MAX_SAFE_INTEGER and validates snapshots",
    async () => {
      const db = getDb();
      const hId = crypto.randomUUID();
      const lId = crypto.randomUUID();

      await db.insert(households).values({
        id: hId,
        name: "Household BigInt",
        defaultCurrency: "PLN",
      });

      const massiveAmount = 15_000_000_000_000_000n; // > 9_007_199_254_740_991n
      const snapshotDate = new Date("2026-09-01T10:00:00Z");

      const liability = createLiability({
        id: liabilityId(lId),
        householdId: householdId(hId),
        name: "Mega Loan",
        kind: "loan",
        currency: "PLN",
        observedOutstanding: money(massiveAmount, "PLN"),
        observedOutstandingAt: snapshotDate,
        lender: "MegaBank",
      });

      await insertLiabilityInDb(hId, liability);

      const found = await findLiabilityById(hId, lId);
      expect(found).not.toBeNull();
      expect(found?.observedOutstandingMinor).toBe(massiveAmount);
      expect(found?.observedOutstandingMinor).toBeGreaterThan(
        BigInt(Number.MAX_SAFE_INTEGER),
      );
      expect(found?.lender).toBe("MegaBank");
    },
  );

  it.runIf(isPostgresAvailable)(
    "enforces household isolation across liabilities and repayments",
    async () => {
      const db = getDb();
      const householdA = crypto.randomUUID();
      const householdB = crypto.randomUUID();
      const liabilityAId = crypto.randomUUID();

      await db.insert(households).values([
        { id: householdA, name: "Household A", defaultCurrency: "PLN" },
        { id: householdB, name: "Household B", defaultCurrency: "PLN" },
      ]);

      const liabilityA = createLiability({
        id: liabilityId(liabilityAId),
        householdId: householdId(householdA),
        name: "Loan in A",
        currency: "PLN",
      });

      await insertLiabilityInDb(householdA, liabilityA);

      // Household B cannot see liability in A
      const foundInB = await findLiabilityById(householdB, liabilityAId);
      expect(foundInB).toBeNull();

      const listB = await listLiabilitiesByHousehold(householdB);
      expect(listB).toHaveLength(0);

      // Household B cannot update liability in A
      await expect(
        updateLiabilityInDb({
          householdId: householdB,
          id: liabilityAId,
          expectedVersion: 1,
          liability: liabilityA,
        }),
      ).rejects.toThrow(LiabilityNotFoundError);

      // Household B cannot archive liability in A
      await expect(
        archiveLiabilityInDb(householdB, liabilityAId, 1),
      ).rejects.toThrow(LiabilityNotFoundError);
    },
  );

  it.runIf(isPostgresAvailable)(
    "validates destination account belongs to household and matches currency",
    async () => {
      const db = getDb();
      const householdA = crypto.randomUUID();
      const householdB = crypto.randomUUID();
      const accountInB = crypto.randomUUID();
      const eurAccountInA = crypto.randomUUID();
      const validAccountInA = crypto.randomUUID();

      await db.insert(households).values([
        { id: householdA, name: "Household Dest A", defaultCurrency: "PLN" },
        { id: householdB, name: "Household Dest B", defaultCurrency: "PLN" },
      ]);

      await db.insert(accounts).values([
        { id: accountInB, householdId: householdB, name: "Acc in B", type: "checking", currency: "PLN" },
        { id: eurAccountInA, householdId: householdA, name: "EUR in A", type: "checking", currency: "EUR" },
        { id: validAccountInA, householdId: householdA, name: "PLN in A", type: "checking", currency: "PLN" },
      ]);

      // 1. Destination account in different household rejected
      const crossHouseholdLiability = createLiability({
        id: liabilityId(crypto.randomUUID()),
        householdId: householdId(householdA),
        name: "Cross Loan",
        currency: "PLN",
        destinationAccountId: accountId(accountInB),
      });

      await expect(
        insertLiabilityInDb(householdA, crossHouseholdLiability),
      ).rejects.toThrow(LiabilityDestinationAccountNotFoundError);

      // 2. Destination account with currency mismatch rejected
      const currencyMismatchLiability = createLiability({
        id: liabilityId(crypto.randomUUID()),
        householdId: householdId(householdA),
        name: "Currency Mismatch Loan",
        currency: "PLN",
        destinationAccountId: accountId(eurAccountInA),
      });

      await expect(
        insertLiabilityInDb(householdA, currencyMismatchLiability),
      ).rejects.toThrow(LiabilityDestinationAccountCurrencyMismatchError);

      // 3. Valid destination account succeeds
      const validLiability = createLiability({
        id: liabilityId(crypto.randomUUID()),
        householdId: householdId(householdA),
        name: "Valid Loan",
        currency: "PLN",
        destinationAccountId: accountId(validAccountInA),
      });

      const inserted = await insertLiabilityInDb(householdA, validLiability);
      expect(inserted.destinationAccountId).toBe(validAccountInA);
    },
  );

  it.runIf(isPostgresAvailable)(
    "enforces optimistic concurrency on liability updates and archives",
    async () => {
      const db = getDb();
      const hId = crypto.randomUUID();
      const lId = crypto.randomUUID();

      await db.insert(households).values({
        id: hId,
        name: "Household Concurrency",
        defaultCurrency: "PLN",
      });

      const liability = createLiability({
        id: liabilityId(lId),
        householdId: householdId(hId),
        name: "Initial Name",
        currency: "PLN",
      });

      await insertLiabilityInDb(hId, liability);

      // Update with matching version 1 succeeds -> becomes version 2
      const updated = await updateLiabilityInDb({
        householdId: hId,
        id: lId,
        expectedVersion: 1,
        liability: createLiability({
          id: liabilityId(lId),
          householdId: householdId(hId),
          name: "Second Name",
          currency: "PLN",
          version: 2,
        }),
      });

      expect(updated.version).toBe(2);
      expect(updated.name).toBe("Second Name");

      // Stale update with version 1 fails with conflict error
      await expect(
        updateLiabilityInDb({
          householdId: hId,
          id: lId,
          expectedVersion: 1,
          liability: updated,
        }),
      ).rejects.toThrow(LiabilityVersionConflictError);

      // Archive with matching version 2 succeeds -> version 3
      const archived = await archiveLiabilityInDb(hId, lId, 2);
      expect(archived.version).toBe(3);
      expect(archived.archivedAt).not.toBeNull();

      // Unarchive with matching version 3 succeeds -> version 4
      const unarchived = await unarchiveLiabilityInDb(hId, lId, 3);
      expect(unarchived.version).toBe(4);
      expect(unarchived.archivedAt).toBeNull();
    },
  );

  it.runIf(isPostgresAvailable)(
    "records repayment with atomic cash transaction and audit trail, preserving unknown allocation",
    async () => {
      const db = getDb();
      const hId = crypto.randomUUID();
      const persId = crypto.randomUUID();
      const accId = crypto.randomUUID();
      const lId = crypto.randomUUID();
      const repId = crypto.randomUUID();
      const txId = crypto.randomUUID();

      await db.insert(households).values({
        id: hId,
        name: "Household Repayment",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: persId,
        displayName: "Payer Person",
      });
      await db.insert(householdMemberships).values({
        householdId: hId,
        personId: persId,
      });
      await db.insert(accounts).values({
        id: accId,
        householdId: hId,
        name: "Checking",
        type: "checking",
        currency: "PLN",
      });

      const liability = createLiability({
        id: liabilityId(lId),
        householdId: householdId(hId),
        name: "Bank Loan",
        currency: "PLN",
      });
      await insertLiabilityInDb(hId, liability);

      // Create repayment with UNKNOWN allocation (principal/interest/fee null)
      const repayment = createLiabilityRepayment({
        id: liabilityRepaymentId(repId),
        householdId: householdId(hId),
        liabilityId: liabilityId(lId),
        transactionId: transactionId(txId),
        paidAt: new Date("2026-09-08T12:00:00Z"),
        amount: money(500_00n, "PLN"),
      });

      // Create linked cash outflow transaction
      const cashTx = createExpense({
        id: transactionId(txId),
        householdId: householdId(hId),
        accountId: accountId(accId),
        amount: money(500_00n, "PLN"),
        payee: "Bank Loan",
        paidByPersonId: personId(persId),
        occurredOn: new Date("2026-09-08T12:00:00Z"),
      });

      const result = await recordLiabilityRepaymentInDb({
        householdId: hId,
        repayment,
        cashTransaction: cashTx,
        auditActor: { source: "manual", personId: persId },
      });

      expect(result.repayment.allocationState).toBe("unknown");
      expect(result.repayment.principalAmount).toBeNull();
      expect(result.repayment.interestAmount).toBeNull();
      expect(result.repayment.feeAmount).toBeNull();
      expect(result.transaction?.id).toBe(txId);

      // Verify audit entry was written atomically
      const [auditEntry] = await db
        .select()
        .from(transactionAuditEntries)
        .where(eq(transactionAuditEntries.transactionId, txId))
        .limit(1);

      expect(auditEntry).toBeDefined();
      expect(auditEntry!.operation).toBe("create");

      // Verify listed repayments
      const list = await listLiabilityRepaymentsByHousehold(hId, lId);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(repId);
      expect(list[0]?.amount.amountMinor).toBe(500_00n);
      expect(list[0]?.allocationState).toBe("unknown");
    },
  );

  it.runIf(isPostgresAvailable)(
    "voids repayment and atomically voids linked transaction with audit log",
    async () => {
      const db = getDb();
      const hId = crypto.randomUUID();
      const persId = crypto.randomUUID();
      const accId = crypto.randomUUID();
      const lId = crypto.randomUUID();
      const repId = crypto.randomUUID();
      const txId = crypto.randomUUID();

      await db.insert(households).values({
        id: hId,
        name: "Household Void",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: persId,
        displayName: "Void Payer",
      });
      await db.insert(householdMemberships).values({
        householdId: hId,
        personId: persId,
      });
      await db.insert(accounts).values({
        id: accId,
        householdId: hId,
        name: "Checking",
        type: "checking",
        currency: "PLN",
      });

      const liability = createLiability({
        id: liabilityId(lId),
        householdId: householdId(hId),
        name: "Equipment Loan",
        currency: "PLN",
      });
      await insertLiabilityInDb(hId, liability);

      const repayment = createLiabilityRepayment({
        id: liabilityRepaymentId(repId),
        householdId: householdId(hId),
        liabilityId: liabilityId(lId),
        transactionId: transactionId(txId),
        paidAt: new Date("2026-09-08T12:00:00Z"),
        amount: money(300_00n, "PLN"),
      });

      const cashTx = createExpense({
        id: transactionId(txId),
        householdId: householdId(hId),
        accountId: accountId(accId),
        amount: money(300_00n, "PLN"),
        payee: "Equipment Loan",
        paidByPersonId: personId(persId),
        occurredOn: new Date("2026-09-08T12:00:00Z"),
      });

      await recordLiabilityRepaymentInDb({
        householdId: hId,
        repayment,
        cashTransaction: cashTx,
      });

      // Void the repayment
      const voided = await voidLiabilityRepaymentInDb({
        householdId: hId,
        id: repId,
        expectedVersion: 1,
        voidReason: "Bank reversed payment",
      });

      expect(voided.voidedAt).not.toBeNull();
      expect(voided.voidReason).toBe("Bank reversed payment");
      expect(voided.version).toBe(2);

      // Verify the linked transaction was also voided
      const [txRow] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txId))
        .limit(1);
      expect(txRow).toBeDefined();
      expect(txRow!.voidedAt).not.toBeNull();
      expect(txRow!.version).toBe(2);

      // Verify audit entry for the void operation
      const auditEntries = await db
        .select()
        .from(transactionAuditEntries)
        .where(eq(transactionAuditEntries.transactionId, txId));

      expect(auditEntries).toHaveLength(2); // 1 create, 1 void
      const voidAudit = auditEntries.find((a) => a.operation === "void");
      expect(voidAudit).toBeDefined();

      // Double voiding fails
      await expect(
        voidLiabilityRepaymentInDb({
          householdId: hId,
          id: repId,
          expectedVersion: 2,
        }),
      ).rejects.toThrow(LiabilityRepaymentAlreadyVoidedError);
    },
  );
});
