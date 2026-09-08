import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nodvis/finance-db")>();
  return {
    ...actual,
    findTransactionById: vi.fn(),
    listAccountsByHousehold: vi.fn(),
    listCategoriesByHousehold: vi.fn(),
    listHouseholdMembers: vi.fn(),
    listTransactionAuditEntries: vi.fn(),
  };
});

import {
  findTransactionById,
  listAccountsByHousehold,
  listCategoriesByHousehold,
  listHouseholdMembers,
  listTransactionAuditEntries,
  TransactionNotFoundError,
} from "@nodvis/finance-db";
import type { TransactionAuditRow } from "@nodvis/finance-db";
import {
  accountId,
  categoryId,
  createExpense,
  createIncome,
  createTransactionAuditSnapshot,
  createTransfer,
  householdId,
  money,
  personId,
  transactionId,
} from "@nodvis/finance-domain";

import { getTransactionHistory } from "./history";
import type { AuthorizedHouseholdContext } from "./service";

const validHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
const validPerson1 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
const validPerson2 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a3");
const validAccount1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
const validAccount2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";
const validCategoryId = "018f47a0-7762-7b9c-8d17-27f2f79e59a6";
const validCategoryId2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a7";
const validTxId = "018f47a0-7762-7b9c-8d17-27f2f79e59a8";

const testContext: AuthorizedHouseholdContext = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson1,
};

const mockAccounts = [
  {
    id: validAccount1,
    householdId: validHousehold,
    name: "Checking",
    type: "checking" as const,
    currency: "PLN",
    balanceSnapshotMinor: null,
    balanceSnapshotAt: null,
    archivedAt: null,
    ownerPersonIds: [],
  },
  {
    id: validAccount2,
    householdId: validHousehold,
    name: "Savings",
    type: "savings" as const,
    currency: "PLN",
    balanceSnapshotMinor: null,
    balanceSnapshotAt: null,
    archivedAt: null,
    ownerPersonIds: [],
  },
];

const mockCategories = [
  {
    id: validCategoryId,
    householdId: validHousehold,
    name: "Groceries",
    applicability: "expense" as const,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: validCategoryId2,
    householdId: validHousehold,
    name: "Dining Out",
    applicability: "expense" as const,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockMembers = [
  {
    membershipId: "mem-1",
    personId: validPerson1,
    authUserId: "user-1",
    displayName: "Alice",
    role: "owner" as const,
    joinedAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    membershipId: "mem-2",
    personId: validPerson2,
    authUserId: "user-2",
    displayName: "Bob",
    role: "member" as const,
    joinedAt: new Date("2026-01-01T00:00:00Z"),
  },
];

describe("getTransactionHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listAccountsByHousehold).mockResolvedValue(mockAccounts);
    vi.mocked(listCategoriesByHousehold).mockResolvedValue(mockCategories);
    vi.mocked(listHouseholdMembers).mockResolvedValue(mockMembers);
  });

  it("throws TransactionNotFoundError when transaction does not exist in household", async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce(null);

    await expect(
      getTransactionHistory(testContext, validTxId),
    ).rejects.toThrow(TransactionNotFoundError);
    expect(findTransactionById).toHaveBeenCalledWith(validHousehold, validTxId);
  });

  it("returns explicit baseline entry for legacy transactions with no audit records", async () => {
    const legacyTx = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(12500n, "PLN"),
      payee: "Supermarket",
      paidByPersonId: validPerson1,
      occurredOn: new Date("2026-08-15T12:00:00Z"),
      categoryId: categoryId(validCategoryId),
      version: 1,
    });

    vi.mocked(findTransactionById).mockResolvedValueOnce(legacyTx);
    vi.mocked(listTransactionAuditEntries).mockResolvedValueOnce([]);

    const result = await getTransactionHistory(testContext, validTxId);

    expect(result.transactionId).toBe(validTxId);
    expect(result.history).toHaveLength(1);

    const entry = result.history[0]!;
    expect(entry.isBaseline).toBe(true);
    expect(entry.operation).toBe("baseline");
    expect(entry.source).toBe("legacy");
    expect(entry.actor).toBeNull();
    expect(entry.changes).toEqual([]);
    expect(entry.summary).toEqual({
      kind: "expense",
      amountFormatted: "125.00 PLN",
      occurredOn: "2026-08-15",
      accountName: "Checking (PLN)",
      fromAccountName: null,
      toAccountName: null,
      categoryName: "Groceries",
      counterparty: "Supermarket",
      personName: "Alice",
      status: "active",
    });
  });

  it("returns complete chronological history for create -> 2 corrections -> void", async () => {
    const v1 = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(5000n, "PLN"),
      payee: "Cafe",
      paidByPersonId: validPerson1,
      occurredOn: new Date("2026-09-01T10:00:00Z"),
      categoryId: categoryId(validCategoryId),
      version: 1,
    });

    const v2 = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(6500n, "PLN"),
      payee: "Cafe Del Mar",
      paidByPersonId: validPerson1,
      occurredOn: new Date("2026-09-01T10:00:00Z"),
      categoryId: categoryId(validCategoryId2),
      version: 2,
    });

    const v3 = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount2),
      amount: money(6500n, "PLN"),
      payee: "Cafe Del Mar",
      paidByPersonId: validPerson2,
      occurredOn: new Date("2026-09-02T10:00:00Z"),
      categoryId: categoryId(validCategoryId2),
      version: 3,
    });

    const v4 = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount2),
      amount: money(6500n, "PLN"),
      payee: "Cafe Del Mar",
      paidByPersonId: validPerson2,
      occurredOn: new Date("2026-09-02T10:00:00Z"),
      categoryId: categoryId(validCategoryId2),
      version: 4,
      voidedAt: new Date("2026-09-03T15:00:00Z"),
      voidReason: "Accidental entry",
    });

    const s1 = createTransactionAuditSnapshot(v1);
    const s2 = createTransactionAuditSnapshot(v2);
    const s3 = createTransactionAuditSnapshot(v3);
    const s4 = createTransactionAuditSnapshot(v4);

    const auditRows: TransactionAuditRow[] = [
      {
        id: "audit-1",
        transactionId: validTxId,
        householdId: validHousehold,
        revision: 1,
        operation: "create",
        source: "manual",
        authUserId: "user-1",
        personId: validPerson1,
        beforeState: null,
        afterState: s1,
        voidReason: null,
        recordedAt: new Date("2026-09-01T10:05:00Z"),
      },
      {
        id: "audit-2",
        transactionId: validTxId,
        householdId: validHousehold,
        revision: 2,
        operation: "correction",
        source: "manual",
        authUserId: "user-1",
        personId: validPerson1,
        beforeState: s1,
        afterState: s2,
        voidReason: null,
        recordedAt: new Date("2026-09-01T14:00:00Z"),
      },
      {
        id: "audit-3",
        transactionId: validTxId,
        householdId: validHousehold,
        revision: 3,
        operation: "correction",
        source: "manual",
        authUserId: "user-2",
        personId: validPerson2,
        beforeState: s2,
        afterState: s3,
        voidReason: null,
        recordedAt: new Date("2026-09-02T11:00:00Z"),
      },
      {
        id: "audit-4",
        transactionId: validTxId,
        householdId: validHousehold,
        revision: 4,
        operation: "void",
        source: "manual",
        authUserId: "user-1",
        personId: validPerson1,
        beforeState: s3,
        afterState: s4,
        voidReason: "Accidental entry",
        recordedAt: new Date("2026-09-03T15:00:00Z"),
      },
    ];

    vi.mocked(findTransactionById).mockResolvedValueOnce(v4);
    vi.mocked(listTransactionAuditEntries).mockResolvedValueOnce(auditRows);

    const result = await getTransactionHistory(testContext, validTxId);

    expect(result.history).toHaveLength(4);

    // Entry 1: create
    const e1 = result.history[0]!;
    expect(e1.revision).toBe(1);
    expect(e1.operation).toBe("create");
    expect(e1.actor).toEqual({
      authUserId: "user-1",
      personId: validPerson1,
      displayName: "Alice",
    });
    expect(e1.isBaseline).toBe(false);
    expect(e1.changes.some((c) => c.field === "amount" && c.after === "50.00 PLN")).toBe(true);

    // Entry 2: correction 1 (amount, payee, category changed)
    const e2 = result.history[1]!;
    expect(e2.revision).toBe(2);
    expect(e2.operation).toBe("correction");
    expect(e2.changes).toEqual([
      {
        field: "amount",
        fieldLabelKey: "fieldAmount",
        before: "50.00 PLN",
        after: "65.00 PLN",
      },
      {
        field: "category",
        fieldLabelKey: "fieldCategory",
        before: "Groceries",
        after: "Dining Out",
      },
      {
        field: "payee",
        fieldLabelKey: "fieldPayee",
        before: "Cafe",
        after: "Cafe Del Mar",
      },
    ]);

    // Entry 3: correction 2 (date, account, person changed)
    const e3 = result.history[2]!;
    expect(e3.revision).toBe(3);
    expect(e3.operation).toBe("correction");
    expect(e3.actor?.displayName).toBe("Bob");
    expect(e3.changes).toEqual([
      {
        field: "date",
        fieldLabelKey: "fieldDate",
        before: "2026-09-01",
        after: "2026-09-02",
      },
      {
        field: "account",
        fieldLabelKey: "fieldAccount",
        before: "Checking (PLN)",
        after: "Savings (PLN)",
      },
      {
        field: "person",
        fieldLabelKey: "fieldPayer",
        before: "Alice",
        after: "Bob",
      },
    ]);

    // Entry 4: void (status, voidReason)
    const e4 = result.history[3]!;
    expect(e4.revision).toBe(4);
    expect(e4.operation).toBe("void");
    expect(e4.voidReason).toBe("Accidental entry");
    expect(e4.changes).toEqual([
      {
        field: "status",
        fieldLabelKey: "fieldStatus",
        before: "active",
        after: "voided",
      },
      {
        field: "voidReason",
        fieldLabelKey: "fieldVoidReason",
        before: null,
        after: "Accidental entry",
      },
    ]);
  });

  it("handles transfer transactions and before/after account changes without exposing UUIDs", async () => {
    const t1 = createTransfer({
      id: transactionId(validTxId),
      householdId: validHousehold,
      fromAccountId: accountId(validAccount1),
      toAccountId: accountId(validAccount2),
      amount: money(100000n, "PLN"),
      occurredOn: new Date("2026-09-05T08:00:00Z"),
      version: 1,
    });

    const s1 = createTransactionAuditSnapshot(t1);

    const auditRows: TransactionAuditRow[] = [
      {
        id: "audit-1",
        transactionId: validTxId,
        householdId: validHousehold,
        revision: 1,
        operation: "create",
        source: "manual",
        authUserId: "user-1",
        personId: validPerson1,
        beforeState: null,
        afterState: s1,
        voidReason: null,
        recordedAt: new Date("2026-09-05T08:00:00Z"),
      },
    ];

    vi.mocked(findTransactionById).mockResolvedValueOnce(t1);
    vi.mocked(listTransactionAuditEntries).mockResolvedValueOnce(auditRows);

    const result = await getTransactionHistory(testContext, validTxId);
    expect(result.history).toHaveLength(1);

    const entry = result.history[0]!;
    expect(entry.summary.kind).toBe("transfer");
    expect(entry.summary.fromAccountName).toBe("Checking (PLN)");
    expect(entry.summary.toAccountName).toBe("Savings (PLN)");

    const fromAccChange = entry.changes.find((c) => c.field === "fromAccount");
    const toAccChange = entry.changes.find((c) => c.field === "toAccount");
    expect(fromAccChange?.after).toBe("Checking (PLN)");
    expect(toAccChange?.after).toBe("Savings (PLN)");
    // No UUIDs in changes
    expect(fromAccChange?.after).not.toContain(validAccount1);
    expect(toAccChange?.after).not.toContain(validAccount2);
  });

  it("preserves exact large bigint amounts without floating point distortion", async () => {
    // 9007199254740995 minor units is beyond Number.MAX_SAFE_INTEGER
    const largeMinor = 9007199254740995n;
    const expense = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(largeMinor, "PLN"),
      payee: "Enterprise Supplier",
      paidByPersonId: validPerson1,
      occurredOn: new Date("2026-09-05T08:00:00Z"),
      version: 1,
    });

    const s1 = createTransactionAuditSnapshot(expense);
    expect(s1.amountMinor).toBe(largeMinor.toString());

    const auditRows: TransactionAuditRow[] = [
      {
        id: "audit-1",
        transactionId: validTxId,
        householdId: validHousehold,
        revision: 1,
        operation: "create",
        source: "manual",
        authUserId: "user-1",
        personId: validPerson1,
        beforeState: null,
        afterState: s1,
        voidReason: null,
        recordedAt: new Date("2026-09-05T08:00:00Z"),
      },
    ];

    vi.mocked(findTransactionById).mockResolvedValueOnce(expense);
    vi.mocked(listTransactionAuditEntries).mockResolvedValueOnce(auditRows);

    const result = await getTransactionHistory(testContext, validTxId);
    const entry = result.history[0]!;
    expect(entry.summary.amountFormatted).toBe("90071992547409.95 PLN");
  });

  it("reconstructs baseline when first recorded audit entry revision is > 1", async () => {
    const v1 = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(1000n, "PLN"),
      payee: "Old Store",
      paidByPersonId: validPerson1,
      occurredOn: new Date("2026-08-01T08:00:00Z"),
      version: 1,
    });

    const v2 = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(2000n, "PLN"),
      payee: "New Store",
      paidByPersonId: validPerson1,
      occurredOn: new Date("2026-08-01T08:00:00Z"),
      version: 2,
    });

    const s1 = createTransactionAuditSnapshot(v1);
    const s2 = createTransactionAuditSnapshot(v2);

    // Audit only starts at revision 2 (correction)
    const auditRows: TransactionAuditRow[] = [
      {
        id: "audit-2",
        transactionId: validTxId,
        householdId: validHousehold,
        revision: 2,
        operation: "correction",
        source: "manual",
        authUserId: "user-1",
        personId: validPerson1,
        beforeState: s1,
        afterState: s2,
        voidReason: null,
        recordedAt: new Date("2026-09-01T08:00:00Z"),
      },
    ];

    vi.mocked(findTransactionById).mockResolvedValueOnce(v2);
    vi.mocked(listTransactionAuditEntries).mockResolvedValueOnce(auditRows);

    const result = await getTransactionHistory(testContext, validTxId);
    expect(result.history).toHaveLength(2);

    const baseline = result.history[0]!;
    expect(baseline.isBaseline).toBe(true);
    expect(baseline.revision).toBe(1);
    expect(baseline.operation).toBe("baseline");
    expect(baseline.summary.amountFormatted).toBe("10.00 PLN");
    expect(baseline.summary.counterparty).toBe("Old Store");

    const correction = result.history[1]!;
    expect(correction.isBaseline).toBe(false);
    expect(correction.revision).toBe(2);
    expect(correction.summary.amountFormatted).toBe("20.00 PLN");
    expect(correction.summary.counterparty).toBe("New Store");
  });
});
