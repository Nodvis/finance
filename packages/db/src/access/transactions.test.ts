import { describe, expect, it } from "vitest";

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
  mapRowToTransaction,
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
      version: 1,
      voidedAt: null,
      voidReason: null,
      submissionId: null,
      createdAt,
      updatedAt,
    };

    const tx = mapRowToTransaction(row);
    expect(isExpense(tx)).toBe(true);
    if (isExpense(tx)) {
      expect(tx.categoryId).toBe(categoryUuid);
    }
  });

  it("hydrates an income row into a frozen IncomeTransaction domain entity", () => {
    const row: TransactionRow = {
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
      version: 1,
      voidedAt: null,
      voidReason: null,
      submissionId: null,
      createdAt,
      updatedAt,
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
      version: 1,
      voidedAt: null,
      voidReason: null,
      submissionId: null,
      createdAt,
      updatedAt,
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
      submissionId: null,
      createdAt,
      updatedAt,
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
