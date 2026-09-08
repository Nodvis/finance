import { describe, expect, it } from "vitest";

import {
  accountId,
  categoryId,
  correctExpense,
  createExpense,
  createIncome,
  createTransfer,
  householdId,
  money,
  personId,
  transactionId,
  voidTransaction,
} from "./index";
import {
  TRANSACTION_AUDIT_OPERATIONS,
  TRANSACTION_AUDIT_SOURCES,
  createTransactionAuditSnapshot,
  diffTransactionAuditSnapshots,
} from "./audit";

describe("audit domain models", () => {
  const hId = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
  const aId1 = accountId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
  const aId2 = accountId("018f47a0-7762-7b9c-8d17-27f2f79e59a3");
  const pId1 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a4");
  const pId2 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a5");
  const cId1 = categoryId("018f47a0-7762-7b9c-8d17-27f2f79e59a6");
  const cId2 = categoryId("018f47a0-7762-7b9c-8d17-27f2f79e59a7");
  const txId1 = transactionId("018f47a0-7762-7b9c-8d17-27f2f79e59a8");

  it("exports accepted operations and sources", () => {
    expect(TRANSACTION_AUDIT_OPERATIONS).toEqual(["create", "correction", "void"]);
    expect(TRANSACTION_AUDIT_SOURCES).toEqual(["manual", "system", "import"]);
  });

  it("creates an immutable snapshot for an expense with exact bigint amount", () => {
    const hugeAmountMinor = 9007199254740991000n;
    const tx = createExpense({
      id: txId1,
      householdId: hId,
      accountId: aId1,
      amount: money(hugeAmountMinor, "PLN"),
      payee: "Supermarket",
      paidByPersonId: pId1,
      occurredOn: new Date("2026-09-08T10:00:00Z"),
      categoryId: cId1,
    });

    const snapshot = createTransactionAuditSnapshot(tx);

    expect(snapshot.kind).toBe("expense");
    expect(snapshot.amountMinor).toBe(hugeAmountMinor.toString());
    expect(snapshot.currency).toBe("PLN");
    expect(snapshot.accountId).toBe(aId1);
    expect(snapshot.categoryId).toBe(cId1);
    expect(snapshot.payee).toBe("Supermarket");
    expect(snapshot.paidByPersonId).toBe(pId1);
    expect(snapshot.fromAccountId).toBeNull();
    expect(snapshot.toAccountId).toBeNull();
    expect(snapshot.version).toBe(1);
    expect(snapshot.voidedAt).toBeNull();
    expect(snapshot.voidReason).toBeNull();
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("creates an immutable snapshot for a transfer preserving both accounts", () => {
    const tx = createTransfer({
      id: txId1,
      householdId: hId,
      fromAccountId: aId1,
      toAccountId: aId2,
      amount: money(150000n, "EUR"),
      occurredOn: new Date("2026-09-08T11:00:00Z"),
    });

    const snapshot = createTransactionAuditSnapshot(tx);

    expect(snapshot.kind).toBe("transfer");
    expect(snapshot.amountMinor).toBe("150000");
    expect(snapshot.currency).toBe("EUR");
    expect(snapshot.fromAccountId).toBe(aId1);
    expect(snapshot.toAccountId).toBe(aId2);
    expect(snapshot.accountId).toBeNull();
    expect(snapshot.categoryId).toBeNull();
    expect(snapshot.payee).toBeNull();
  });

  it("diffs a newly created transaction (before is null)", () => {
    const tx = createExpense({
      id: txId1,
      householdId: hId,
      accountId: aId1,
      amount: money(5000n, "PLN"),
      payee: "Cafe",
      paidByPersonId: pId1,
      occurredOn: new Date("2026-09-08T10:00:00Z"),
      categoryId: cId1,
    });

    const snapshot = createTransactionAuditSnapshot(tx);
    const diffs = diffTransactionAuditSnapshots(null, snapshot);

    expect(diffs).toContainEqual({
      field: "amount",
      before: null,
      after: "5000 PLN",
    });
    expect(diffs).toContainEqual({
      field: "occurredOn",
      before: null,
      after: tx.occurredOn.toISOString(),
    });
    expect(diffs).toContainEqual({
      field: "accountId",
      before: null,
      after: aId1,
    });
    expect(diffs).toContainEqual({
      field: "categoryId",
      before: null,
      after: cId1,
    });
    expect(diffs).toContainEqual({
      field: "payee",
      before: null,
      after: "Cafe",
    });
    expect(diffs).toContainEqual({
      field: "paidByPersonId",
      before: null,
      after: pId1,
    });
  });

  it("diffs corrections across multiple fields with exact bigint amount", () => {
    const tx1 = createExpense({
      id: txId1,
      householdId: hId,
      accountId: aId1,
      amount: money(1000000000000000n, "PLN"),
      payee: "Old Store",
      paidByPersonId: pId1,
      occurredOn: new Date("2026-09-08T10:00:00Z"),
      categoryId: cId1,
    });

    const tx2 = correctExpense(tx1, {
      accountId: aId2,
      amount: money(2000000000000000n, "PLN"),
      payee: "New Store",
      paidByPersonId: pId2,
      occurredOn: new Date("2026-09-09T10:00:00Z"),
      categoryId: cId2,
    });

    const snap1 = createTransactionAuditSnapshot(tx1);
    const snap2 = createTransactionAuditSnapshot(tx2);
    const diffs = diffTransactionAuditSnapshots(snap1, snap2);

    expect(diffs).toContainEqual({
      field: "amount",
      before: "1000000000000000 PLN",
      after: "2000000000000000 PLN",
    });
    expect(diffs).toContainEqual({
      field: "payee",
      before: "Old Store",
      after: "New Store",
    });
    expect(diffs).toContainEqual({
      field: "accountId",
      before: aId1,
      after: aId2,
    });
    expect(diffs).toContainEqual({
      field: "categoryId",
      before: cId1,
      after: cId2,
    });
    expect(diffs).toContainEqual({
      field: "paidByPersonId",
      before: pId1,
      after: pId2,
    });
    expect(diffs).toContainEqual({
      field: "occurredOn",
      before: tx1.occurredOn.toISOString(),
      after: tx2.occurredOn.toISOString(),
    });
  });

  it("diffs voiding a transaction, detecting status and voidReason changes", () => {
    const tx1 = createIncome({
      id: txId1,
      householdId: hId,
      accountId: aId1,
      amount: money(500000n, "PLN"),
      source: "Client",
      receivedByPersonId: pId1,
      occurredOn: new Date("2026-09-08T10:00:00Z"),
    });

    const voided = voidTransaction(
      tx1,
      "Duplicate invoice recorded",
      new Date("2026-09-08T12:00:00Z"),
    );

    const snap1 = createTransactionAuditSnapshot(tx1);
    const snapVoided = createTransactionAuditSnapshot(voided);
    const diffs = diffTransactionAuditSnapshots(snap1, snapVoided);

    expect(diffs).toContainEqual({
      field: "status",
      before: "active",
      after: "voided",
    });
    expect(diffs).toContainEqual({
      field: "voidReason",
      before: null,
      after: "Duplicate invoice recorded",
    });
  });

  it("returns empty diffs when snapshots are identical", () => {
    const tx = createTransfer({
      id: txId1,
      householdId: hId,
      fromAccountId: aId1,
      toAccountId: aId2,
      amount: money(3000n, "PLN"),
      occurredOn: new Date("2026-09-08T10:00:00Z"),
    });

    const snap = createTransactionAuditSnapshot(tx);
    const diffs = diffTransactionAuditSnapshots(snap, snap);
    expect(diffs).toHaveLength(0);
  });
});
