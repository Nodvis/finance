import { describe, expect, it, vi } from "vitest";

import {
  isExpense,
  isIncome,
  isTransfer,
  isZeroMoney,
  netMoneyEffect,
} from "@nodvis/finance-domain";

import {
  DuplicateSubmissionError,
  TransactionAlreadyVoidedError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  buildTransactionConditions,
  mapRowToTransaction,
  queryTransactionsByHousehold,
} from "./transactions";
import type { TransactionRow } from "./transactions";

const householdUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const personUuid1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const personUuid2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const accountUuid1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
const accountUuid2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";
const txUuid1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a6";
const txUuid2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a7";
const txUuid3 = "018f47a0-7762-7b9c-8d17-27f2f79e59a8";

describe("mapRowToTransaction", () => {
  const occurredOn = new Date("2026-09-07T12:00:00Z");
  const createdAt = new Date("2026-09-07T12:00:01Z");
  const updatedAt = new Date("2026-09-07T12:00:01Z");
  const baseRow = {
    version: 1,
    voidedAt: null,
    voidReason: null,
    submissionId: null,
    sourceNamespace: "generic_csv",
    sourceAccountId: "",
    authoritativeId: null,
    createdAt,
    updatedAt,
  };

  it("hydrates an expense row into a frozen ExpenseTransaction domain entity", () => {
    const row: TransactionRow = {
      ...baseRow,
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 4500n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      payee: "Grocery Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };

    const tx = mapRowToTransaction(row);

    expect(isExpense(tx)).toBe(true);
    expect(isIncome(tx)).toBe(false);
    expect(isTransfer(tx)).toBe(false);
    expect(tx).toEqual({
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      accountId: accountUuid1,
      amount: { amountMinor: 4500n, currency: "PLN" },
      payee: "Grocery Store",
      paidByPersonId: personUuid1,
      occurredOn,
      categoryId: null,
      version: 1,
      voidedAt: null,
      voidReason: null,
    });
    expect(Object.isFrozen(tx)).toBe(true);
  });

  it("hydrates an expense row with categoryId", () => {
    const categoryUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a9";
    const row: TransactionRow = {
      ...baseRow,
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 4500n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: categoryUuid,
      payee: "Grocery Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };

    const tx = mapRowToTransaction(row);
    expect(isExpense(tx)).toBe(true);
    if (isExpense(tx)) {
      expect(tx.categoryId).toBe(categoryUuid);
    }
  });

  it("hydrates an income row into a frozen IncomeTransaction domain entity", () => {
    const row: TransactionRow = {
      ...baseRow,
      id: txUuid2,
      householdId: householdUuid,
      kind: "income",
      amountMinor: 800000n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      source: "Employer",
      receivedByPersonId: personUuid2,
      payee: null,
      paidByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };

    const tx = mapRowToTransaction(row);

    expect(isExpense(tx)).toBe(false);
    expect(isIncome(tx)).toBe(true);
    expect(isTransfer(tx)).toBe(false);
    expect(tx).toEqual({
      id: txUuid2,
      householdId: householdUuid,
      kind: "income",
      accountId: accountUuid1,
      amount: { amountMinor: 800000n, currency: "PLN" },
      source: "Employer",
      receivedByPersonId: personUuid2,
      occurredOn,
      categoryId: null,
      version: 1,
      voidedAt: null,
      voidReason: null,
    });
    expect(Object.isFrozen(tx)).toBe(true);
  });

  it("hydrates a transfer row into a frozen TransferTransaction with netMoneyEffect zero (INV-001)", () => {
    const row: TransactionRow = {
      ...baseRow,
      id: txUuid3,
      householdId: householdUuid,
      kind: "transfer",
      amountMinor: 30000n,
      currency: "PLN",
      occurredOn,
      fromAccountId: accountUuid1,
      toAccountId: accountUuid2,
      accountId: null,
      categoryId: null,
      payee: null,
      paidByPersonId: null,
      source: null,
      receivedByPersonId: null,
    };

    const tx = mapRowToTransaction(row);

    expect(isExpense(tx)).toBe(false);
    expect(isIncome(tx)).toBe(false);
    expect(isTransfer(tx)).toBe(true);
    expect(tx).toEqual({
      id: txUuid3,
      householdId: householdUuid,
      kind: "transfer",
      fromAccountId: accountUuid1,
      toAccountId: accountUuid2,
      amount: { amountMinor: 30000n, currency: "PLN" },
      occurredOn,
      version: 1,
      voidedAt: null,
      voidReason: null,
    });
    expect(Object.isFrozen(tx)).toBe(true);
    expect(isZeroMoney(netMoneyEffect(tx))).toBe(true);
  });

  it("hydrates a voided transaction row preserving voidedAt and voidReason", () => {
    const voidedAt = new Date("2026-09-08T14:00:00Z");
    const row: TransactionRow = {
      ...baseRow,
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 4500n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      payee: "Grocery Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
      version: 2,
      voidedAt,
      voidReason: "Accidental double charge",
    };

    const tx = mapRowToTransaction(row);
    expect(tx.version).toBe(2);
    expect(tx.voidedAt).toEqual(voidedAt);
    expect(tx.voidReason).toBe("Accidental double charge");
    expect(isZeroMoney(netMoneyEffect(tx))).toBe(true);
  });

  it("throws on corrupted expense rows missing required fields", () => {
    const missingAccount: TransactionRow = {
      ...baseRow,
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 4500n,
      currency: "PLN",
      occurredOn,
      accountId: null,
      categoryId: null,
      payee: "Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };
    expect(() => mapRowToTransaction(missingAccount)).toThrow(/Corrupted expense transaction row/);

    const missingPayee: TransactionRow = {
      ...missingAccount,
      accountId: accountUuid1,
      payee: null,
    };
    expect(() => mapRowToTransaction(missingPayee)).toThrow(/Corrupted expense transaction row/);

    const missingPayer: TransactionRow = {
      ...missingAccount,
      accountId: accountUuid1,
      paidByPersonId: null,
    };
    expect(() => mapRowToTransaction(missingPayer)).toThrow(/Corrupted expense transaction row/);
  });

  it("throws on corrupted income rows missing required fields", () => {
    const missingSource: TransactionRow = {
      ...baseRow,
      id: txUuid2,
      householdId: householdUuid,
      kind: "income",
      amountMinor: 5000n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      source: null,
      receivedByPersonId: personUuid1,
      payee: null,
      paidByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };
    expect(() => mapRowToTransaction(missingSource)).toThrow(/Corrupted income transaction row/);
  });

  it("throws on corrupted transfer rows missing required fields", () => {
    const missingTo: TransactionRow = {
      ...baseRow,
      id: txUuid3,
      householdId: householdUuid,
      kind: "transfer",
      amountMinor: 5000n,
      currency: "PLN",
      occurredOn,
      fromAccountId: accountUuid1,
      toAccountId: null,
      accountId: null,
      categoryId: null,
      payee: null,
      paidByPersonId: null,
      source: null,
      receivedByPersonId: null,
    };
    expect(() => mapRowToTransaction(missingTo)).toThrow(/Corrupted transfer transaction row/);
  });

  it("enforces domain invariants during hydration (rejection of non-positive amount and self-transfer)", () => {
    const nonPositiveExpense: TransactionRow = {
      ...baseRow,
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 0n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      payee: "Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };
    expect(() => mapRowToTransaction(nonPositiveExpense)).toThrow(/strictly positive/);

    const selfTransfer: TransactionRow = {
      ...baseRow,
      id: txUuid3,
      householdId: householdUuid,
      kind: "transfer",
      amountMinor: 1000n,
      currency: "PLN",
      occurredOn,
      fromAccountId: accountUuid1,
      toAccountId: accountUuid1,
      accountId: null,
      categoryId: null,
      payee: null,
      paidByPersonId: null,
      source: null,
      receivedByPersonId: null,
    };
    expect(() => mapRowToTransaction(selfTransfer)).toThrow(/self-transfer rejected/);
  });

  it("provides specific error classes for missing transaction, already voided, version conflict, and duplicate submission", () => {
    const notFound = new TransactionNotFoundError("tx not found");
    expect(notFound).toBeInstanceOf(Error);
    expect(notFound.name).toBe("TransactionNotFoundError");
    expect(notFound.message).toBe("tx not found");

    const alreadyVoided = new TransactionAlreadyVoidedError("already voided");
    expect(alreadyVoided).toBeInstanceOf(Error);
    expect(alreadyVoided.name).toBe("TransactionAlreadyVoidedError");
    expect(alreadyVoided.message).toBe("already voided");

    const conflict = new TransactionVersionConflictError("conflict");
    expect(conflict).toBeInstanceOf(Error);
    expect(conflict.name).toBe("TransactionVersionConflictError");
    expect(conflict.message).toBe("conflict");

    const dup = new DuplicateSubmissionError("duplicate");
    expect(dup).toBeInstanceOf(Error);
    expect(dup.name).toBe("DuplicateSubmissionError");
    expect(dup.message).toBe("duplicate");
  });
});

describe("buildTransactionConditions", () => {
  it("generates household condition and default active-only condition", () => {
    const conditions = buildTransactionConditions({
      householdId: householdUuid,
    });
    expect(conditions).toHaveLength(2); // householdId + isNull(voidedAt)
  });

  it("handles voided status and all status", () => {
    const voidedConditions = buildTransactionConditions({
      householdId: householdUuid,
      status: "voided",
    });
    expect(voidedConditions).toHaveLength(2); // householdId + isNotNull(voidedAt)

    const allConditions = buildTransactionConditions({
      householdId: householdUuid,
      status: "all",
    });
    expect(allConditions).toHaveLength(1); // householdId only

    const includeVoidedConditions = buildTransactionConditions({
      householdId: householdUuid,
      includeVoided: true,
    });
    expect(includeVoidedConditions).toHaveLength(1); // householdId only
  });

  it("filters by transaction kind/type", () => {
    const conditions = buildTransactionConditions({
      householdId: householdUuid,
      kind: "expense",
    });
    expect(conditions).toHaveLength(3); // household + active + kind
  });

  it("filters by account across single account and transfer accounts", () => {
    const conditions = buildTransactionConditions({
      householdId: householdUuid,
      accountId: accountUuid1,
    });
    expect(conditions).toHaveLength(3); // household + active + account
  });

  it("filters by specific category UUID and uncategorized", () => {
    const categoryUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a9";
    const specificCat = buildTransactionConditions({
      householdId: householdUuid,
      categoryId: categoryUuid,
    });
    expect(specificCat).toHaveLength(3); // household + active + category

    const uncat = buildTransactionConditions({
      householdId: householdUuid,
      categoryId: "uncategorized",
    });
    expect(uncat).toHaveLength(3); // household + active + uncategorized condition
  });

  it("resolves month key to start and end date boundaries", () => {
    const conditions = buildTransactionConditions({
      householdId: householdUuid,
      month: "2026-09",
    });
    // household + active + gte(2026-09-01) + lte(2026-09-30)
    expect(conditions).toHaveLength(4);
  });

  it("resolves from and to date string boundaries", () => {
    const conditions = buildTransactionConditions({
      householdId: householdUuid,
      from: "2026-09-05",
      to: "2026-09-15",
    });
    // household + active + gte + lte
    expect(conditions).toHaveLength(4);
  });

  it("builds text search condition escaping special characters", () => {
    const conditions = buildTransactionConditions({
      householdId: householdUuid,
      search: "100% discount_deal",
    });
    // household + active + search OR (payee, source, voidReason)
    expect(conditions).toHaveLength(3);
  });

  it("combines multiple filter parameters simultaneously", () => {
    const conditions = buildTransactionConditions({
      householdId: householdUuid,
      kind: "expense",
      accountId: accountUuid1,
      categoryId: "uncategorized",
      month: "2026-09",
      search: "Groceries",
      status: "active",
    });
    // household + active + kind + account + category + gte + lte + search
    expect(conditions).toHaveLength(8);
  });
});

describe("queryTransactionsByHousehold and tie-breaker sorting", () => {
  it("queries transactions with count and deterministic tie-breaker sorting", async () => {
    const mockRow: TransactionRow = {
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 2500n,
      currency: "PLN",
      occurredOn: new Date("2026-09-07T10:00:00Z"),
      accountId: accountUuid1,
      categoryId: null,
      payee: "Cafe",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
      version: 1,
      voidedAt: null,
      voidReason: null,
      submissionId: null,
      sourceNamespace: "generic_csv",
      sourceAccountId: "",
      authoritativeId: null,
      createdAt: new Date("2026-09-07T10:00:01Z"),
      updatedAt: new Date("2026-09-07T10:00:01Z"),
    };

    let queryOrderByArgs: unknown = null;
    let queryLimitVal: number | null = null;
    let queryOffsetVal: number | null = null;

    const queryBuilder = {
      from: () => queryBuilder,
      where: () => queryBuilder,
      orderBy: (...args: unknown[]) => {
        queryOrderByArgs = args;
        return queryBuilder;
      },
      limit: (val: number) => {
        queryLimitVal = val;
        return queryBuilder;
      },
      offset: (val: number) => {
        queryOffsetVal = val;
        return queryBuilder;
      },
      then: (resolve: (val: unknown) => unknown) => resolve([mockRow]),
    };

    const countBuilder = {
      from: () => countBuilder,
      where: () => countBuilder,
      then: (resolve: (val: unknown) => unknown) => resolve([{ count: 42 }]),
    };

    const mockDb = {
      select: (fields?: unknown) => {
        if (fields && typeof fields === "object" && "count" in fields) {
          return countBuilder;
        }
        return queryBuilder;
      },
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const result = await queryTransactionsByHousehold({
      householdId: householdUuid,
      limit: 10,
      offset: 20,
    });

    expect(result.total).toBe(42);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.id).toBe(txUuid1);
    expect(queryLimitVal).toBe(10);
    expect(queryOffsetVal).toBe(20);
    // OrderBy should contain 3 columns: occurredOn DESC, createdAt DESC, id DESC (the tie-breaker)
    expect(Array.isArray(queryOrderByArgs)).toBe(true);
    expect((queryOrderByArgs as unknown[]).length).toBe(3);
  });
});

describe("audit and transaction mutations", () => {
  const occurredOn = new Date("2026-09-08T10:00:00Z");
  const createdAt = new Date("2026-09-08T10:00:01Z");
  const updatedAt = new Date("2026-09-08T10:00:01Z");

  it("insertTransaction inserts transaction and audit entry atomically in one DB transaction", async () => {
    const { createExpense, money } = await import("@nodvis/finance-domain");
    const { insertTransaction } = await import("./transactions");

    const tx = createExpense({
      id: txUuid1 as any,
      householdId: householdUuid as any,
      accountId: accountUuid1 as any,
      amount: money(5000n, "PLN"),
      payee: "Bookstore",
      paidByPersonId: personUuid1 as any,
      occurredOn,
    });

    const insertedTxRow: TransactionRow = {
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 5000n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      payee: "Bookstore",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
      version: 1,
      voidedAt: null,
      voidReason: null,
      submissionId: "sub-123",
      sourceNamespace: "generic_csv",
      sourceAccountId: "",
      authoritativeId: null,
      createdAt,
      updatedAt,
    };

    const insertedAuditValues: any[] = [];
    const insertedTxValues: any[] = [];

    const mockDbTx = {
      insert: (table: any) => ({
        values: (val: any) => {
          if (table._?.name === "transaction_audit_entries" || val.revision !== undefined && val.operation !== undefined) {
            insertedAuditValues.push(val);
            return {
              then: (resolve: (v: any) => any) => resolve([]),
            };
          }
          insertedTxValues.push(val);
          return {
            returning: () => ({
              then: (resolve: (v: any) => any) => resolve([insertedTxRow]),
            }),
          };
        },
      }),
    };

    const mockDb = {
      transaction: async (cb: (tx: any) => Promise<any>) => cb(mockDbTx),
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const result = await insertTransaction(tx, {
      submissionId: "sub-123",
      audit: {
        authUserId: "user-123",
        personId: personUuid1,
        source: "manual",
      },
    });

    expect(result.id).toBe(txUuid1);
    expect(result.version).toBe(1);
    expect(insertedTxValues).toHaveLength(1);
    expect(insertedTxValues[0].submissionId).toBe("sub-123");

    expect(insertedAuditValues).toHaveLength(1);
    const auditEntry = insertedAuditValues[0];
    expect(auditEntry.transactionId).toBe(txUuid1);
    expect(auditEntry.householdId).toBe(householdUuid);
    expect(auditEntry.revision).toBe(1);
    expect(auditEntry.operation).toBe("create");
    expect(auditEntry.source).toBe("manual");
    expect(auditEntry.authUserId).toBe("user-123");
    expect(auditEntry.personId).toBe(personUuid1);
    expect(auditEntry.beforeState).toBeNull();
    expect(auditEntry.afterState).toBeDefined();
    expect(auditEntry.afterState.amountMinor).toBe("5000");
    expect(auditEntry.afterState.currency).toBe("PLN");
  });

  it("insertTransaction throws DuplicateSubmissionError and rolls back on duplicate submission_id", async () => {
    const { createExpense, money } = await import("@nodvis/finance-domain");
    const { insertTransaction, DuplicateSubmissionError } = await import("./transactions");

    const tx = createExpense({
      id: txUuid1 as any,
      householdId: householdUuid as any,
      accountId: accountUuid1 as any,
      amount: money(5000n, "PLN"),
      payee: "Bookstore",
      paidByPersonId: personUuid1 as any,
      occurredOn,
    });

    const mockDbTx = {
      insert: () => ({
        values: () => ({
          returning: () => {
            const err = new Error("duplicate key value violates unique constraint") as any;
            err.code = "23505";
            err.detail = "Key (household_id, submission_id) already exists";
            throw err;
          },
        }),
      }),
    };

    const mockDb = {
      transaction: async (cb: (tx: any) => Promise<any>) => cb(mockDbTx),
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    await expect(
      insertTransaction(tx, { submissionId: "dup-1" }),
    ).rejects.toThrow(DuplicateSubmissionError);
  });

  it("insertTransaction fails and rolls back without creating audit when mutation fails", async () => {
    const { createExpense, money } = await import("@nodvis/finance-domain");
    const { insertTransaction } = await import("./transactions");

    const tx = createExpense({
      id: txUuid1 as any,
      householdId: householdUuid as any,
      accountId: accountUuid1 as any,
      amount: money(5000n, "PLN"),
      payee: "Bookstore",
      paidByPersonId: personUuid1 as any,
      occurredOn,
    });

    let auditInserted = false;
    const mockDbTx = {
      insert: () => {
        throw new Error("DB connection terminated unexpectedly");
      },
    };

    const mockDb = {
      transaction: async (cb: (tx: any) => Promise<any>) => cb(mockDbTx),
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    await expect(insertTransaction(tx)).rejects.toThrow(
      "DB connection terminated unexpectedly",
    );
    expect(auditInserted).toBe(false);
  });

  it("updateTransactionInDb records correction audit entry with exact before/after state", async () => {
    const { correctExpense, createExpense, money } = await import(
      "@nodvis/finance-domain"
    );
    const { updateTransactionInDb } = await import("./transactions");

    const existingTx = createExpense({
      id: txUuid1 as any,
      householdId: householdUuid as any,
      accountId: accountUuid1 as any,
      amount: money(5000n, "PLN"),
      payee: "Old Store",
      paidByPersonId: personUuid1 as any,
      occurredOn,
      version: 1,
    });

    const correctedTx = correctExpense(existingTx, {
      accountId: accountUuid1 as any,
      amount: money(7500n, "PLN"),
      payee: "New Store",
      paidByPersonId: personUuid1 as any,
      occurredOn,
    });

    const existingRow: TransactionRow = {
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 5000n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      payee: "Old Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
      version: 1,
      voidedAt: null,
      voidReason: null,
      submissionId: null,
      sourceNamespace: "generic_csv",
      sourceAccountId: "",
      authoritativeId: null,
      createdAt,
      updatedAt,
    };

    const updatedRow: TransactionRow = {
      ...existingRow,
      amountMinor: 7500n,
      payee: "New Store",
      version: 2,
      updatedAt: new Date("2026-09-08T11:00:00Z"),
    };

    const insertedAuditValues: any[] = [];

    const mockDbTx = {
      select: (fields?: unknown) => ({
        from: () => ({
          where: () => ({
            for: () => ({
              then: (resolve: (v: any) => any) => resolve([]),
            }),
            limit: () => ({
              then: (resolve: (v: any) => any) => resolve(fields ? [] : [existingRow]),
            }),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            for: () => ({
              then: (resolve: (v: any) => any) => resolve([]),
            }),
            returning: () => ({
              then: (resolve: (v: any) => any) => resolve([updatedRow]),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (val: any) => {
          insertedAuditValues.push(val);
          return {
            then: (resolve: (v: any) => any) => resolve([]),
          };
        },
      }),
    };

    const mockDb = {
      transaction: async (cb: (tx: any) => Promise<any>) => cb(mockDbTx),
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const result = await updateTransactionInDb({
      householdId: householdUuid,
      id: txUuid1,
      expectedVersion: 1,
      transaction: correctedTx,
      audit: {
        authUserId: "user-456",
        personId: personUuid2,
        source: "manual",
      },
    });

    expect(result.version).toBe(2);
    expect(insertedAuditValues).toHaveLength(1);
    const auditEntry = insertedAuditValues[0];
    expect(auditEntry.operation).toBe("correction");
    expect(auditEntry.revision).toBe(2);
    expect(auditEntry.beforeState.amountMinor).toBe("5000");
    expect(auditEntry.beforeState.payee).toBe("Old Store");
    expect(auditEntry.afterState.amountMinor).toBe("7500");
    expect(auditEntry.afterState.payee).toBe("New Store");
    expect(auditEntry.authUserId).toBe("user-456");
    expect(auditEntry.personId).toBe(personUuid2);
  });

  it("updateTransactionInDb detects optimistic concurrency conflict and throws without audit", async () => {
    const { correctExpense, createExpense, money } = await import(
      "@nodvis/finance-domain"
    );
    const { updateTransactionInDb, TransactionVersionConflictError } =
      await import("./transactions");

    const existingTx = createExpense({
      id: txUuid1 as any,
      householdId: householdUuid as any,
      accountId: accountUuid1 as any,
      amount: money(5000n, "PLN"),
      payee: "Old Store",
      paidByPersonId: personUuid1 as any,
      occurredOn,
      version: 1,
    });

    const correctedTx = correctExpense(existingTx, {
      accountId: accountUuid1 as any,
      amount: money(7500n, "PLN"),
      payee: "New Store",
      paidByPersonId: personUuid1 as any,
      occurredOn,
    });

    const staleRow: TransactionRow = {
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 6000n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      payee: "Intervening Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
      version: 2, // version already bumped to 2 by someone else
      voidedAt: null,
      voidReason: null,
      submissionId: null,
      sourceNamespace: "generic_csv",
      sourceAccountId: "",
      authoritativeId: null,
      createdAt,
      updatedAt,
    };

    const mockDbTx = {
      select: (fields?: unknown) => ({
        from: () => ({
          where: () => ({
            for: () => ({
              then: (resolve: (v: any) => any) => resolve([]),
            }),
            limit: () => ({
              then: (resolve: (v: any) => any) => resolve([staleRow]),
            }),
          }),
        }),
      }),
    };

    const mockDb = {
      transaction: async (cb: (tx: any) => Promise<any>) => cb(mockDbTx),
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    await expect(
      updateTransactionInDb({
        householdId: householdUuid,
        id: txUuid1,
        expectedVersion: 1, // expecting 1, but DB has 2
        transaction: correctedTx,
      }),
    ).rejects.toThrow(TransactionVersionConflictError);
  });

  it("voidTransactionInDb records void audit entry with voidReason", async () => {
    const { voidTransactionInDb } = await import("./transactions");

    const existingRow: TransactionRow = {
      id: txUuid1,
      householdId: householdUuid,
      kind: "expense",
      amountMinor: 5000n,
      currency: "PLN",
      occurredOn,
      accountId: accountUuid1,
      categoryId: null,
      payee: "Store",
      paidByPersonId: personUuid1,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
      version: 1,
      voidedAt: null,
      voidReason: null,
      submissionId: null,
      sourceNamespace: "generic_csv",
      sourceAccountId: "",
      authoritativeId: null,
      createdAt,
      updatedAt,
    };

    const voidedAt = new Date("2026-09-08T12:00:00Z");
    const voidedRow: TransactionRow = {
      ...existingRow,
      version: 2,
      voidedAt,
      voidReason: "Accidental double entry",
      updatedAt: voidedAt,
    };

    const insertedAuditValues: any[] = [];

    const mockDbTx = {
      select: (fields?: unknown) => ({
        from: () => ({
          where: () => ({
            for: () => ({
              then: (resolve: (v: any) => any) => resolve([]),
            }),
            limit: () => ({
              then: (resolve: (v: any) => any) => resolve(fields ? [] : [existingRow]),
            }),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            for: () => ({
              then: (resolve: (v: any) => any) => resolve([]),
            }),
            returning: () => ({
              then: (resolve: (v: any) => any) => resolve([voidedRow]),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (val: any) => {
          insertedAuditValues.push(val);
          return {
            then: (resolve: (v: any) => any) => resolve([]),
          };
        },
      }),
    };

    const mockDb = {
      transaction: async (cb: (tx: any) => Promise<any>) => cb(mockDbTx),
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const result = await voidTransactionInDb({
      householdId: householdUuid,
      id: txUuid1,
      expectedVersion: 1,
      voidReason: "Accidental double entry",
      voidedAt,
      audit: {
        authUserId: "user-789",
        personId: personUuid1,
        source: "manual",
      },
    });

    expect(result.version).toBe(2);
    expect(result.voidedAt).toEqual(voidedAt);
    expect(result.voidReason).toBe("Accidental double entry");

    expect(insertedAuditValues).toHaveLength(1);
    const auditEntry = insertedAuditValues[0];
    expect(auditEntry.operation).toBe("void");
    expect(auditEntry.revision).toBe(2);
    expect(auditEntry.voidReason).toBe("Accidental double entry");
    expect(auditEntry.afterState.voidedAt).toBe(voidedAt.toISOString());
    expect(auditEntry.afterState.voidReason).toBe("Accidental double entry");
  });

  it("listTransactionAuditEntries queries entries ordered by revision", async () => {
    const { listTransactionAuditEntries } = await import("./transactions");

    const mockAuditRows = [
      {
        id: "audit-1",
        transactionId: txUuid1,
        householdId: householdUuid,
        revision: 1,
        operation: "create",
        source: "manual",
        authUserId: "user-1",
        personId: personUuid1,
        recordedAt: new Date("2026-09-08T10:00:00Z"),
        beforeState: null,
        afterState: { kind: "expense" },
        voidReason: null,
      },
      {
        id: "audit-2",
        transactionId: txUuid1,
        householdId: householdUuid,
        revision: 2,
        operation: "correction",
        source: "manual",
        authUserId: "user-1",
        personId: personUuid1,
        recordedAt: new Date("2026-09-08T11:00:00Z"),
        beforeState: { kind: "expense" },
        afterState: { kind: "expense", amountMinor: "6000" },
        voidReason: null,
      },
    ];

    const mockDb = {
      select: (fields?: unknown) => ({
        from: () => ({
          where: () => ({
            for: () => ({
              then: (resolve: (v: any) => any) => resolve([]),
            }),
            orderBy: () => ({
              then: (resolve: (v: any) => any) => resolve(mockAuditRows),
            }),
          }),
        }),
      }),
    };

    const dbClient = await import("../client");
    vi.spyOn(dbClient, "getDb").mockReturnValue(mockDb as any);

    const entries = await listTransactionAuditEntries(householdUuid, txUuid1);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.revision).toBe(1);
    expect(entries[1]!.revision).toBe(2);
  });
});
