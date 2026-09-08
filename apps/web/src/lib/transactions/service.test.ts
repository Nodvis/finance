import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nodvis/finance-db")>();
  return {
    ...actual,
    findAccountInHousehold: vi.fn(),
    findCategoryInHousehold: vi.fn(),
    findTransactionById: vi.fn(),
    insertTransaction: vi.fn(),
    isPersonInHousehold: vi.fn(),
    listAccountsByHousehold: vi.fn(),
    listTransactionsByHousehold: vi.fn(),
    updateTransactionInDb: vi.fn(),
    voidTransactionInDb: vi.fn(),
  };
});

import {
  findAccountInHousehold,
  findCategoryInHousehold,
  findTransactionById,
  insertTransaction,
  isPersonInHousehold,
  listAccountsByHousehold,
  listTransactionsByHousehold,
  updateTransactionInDb,
  voidTransactionInDb,
} from "@nodvis/finance-db";
import type { HouseholdAccountSummary } from "@nodvis/finance-db";
import {
  accountId,
  categoryId,
  createExpense,
  createIncome,
  createTransfer,
  householdId,
  isExpense,
  isIncome,
  isTransfer,
  isVoided,
  money,
  personId,
  transactionId,
  voidTransaction,
} from "@nodvis/finance-domain";

import {
  DuplicateSubmissionError,
  TransactionAccountNotFoundError,
  TransactionAlreadyVoidedError,
  TransactionCategoryApplicabilityError,
  TransactionCategoryArchivedError,
  TransactionCategoryNotAllowedError,
  TransactionCategoryNotFoundError,
  TransactionCurrencyMismatchError,
  TransactionInvalidPersonError,
  TransactionKindMismatchError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  correctManualTransaction,
  createManualTransaction,
  getManualTransaction,
  listHouseholdAccounts,
  listManualTransactions,
  voidManualTransaction,
} from "./service";
import type { AuthorizedHouseholdContext } from "./service";

const validHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
const validPerson1 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
const validPerson2 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a3");
const validAccount1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
const validAccount2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";
const validTxId = "018f47a0-7762-7b9c-8d17-27f2f79e59a6";
const validCategoryId = "018f47a0-7762-7b9c-8d17-27f2f79e59c1";

const makeAccount = (
  overrides: Partial<HouseholdAccountSummary> = {},
): HouseholdAccountSummary => ({
  id: validAccount1,
  householdId: validHousehold,
  name: "Main checking",
  type: "checking",
  currency: "PLN",
  balanceSnapshotMinor: null,
  balanceSnapshotAt: null,
  archivedAt: null,
  ownerPersonIds: [],
  ...overrides,
});

const testContext: AuthorizedHouseholdContext = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson1,
};

describe("transaction-service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  describe("createManualTransaction: expense", () => {
    it("creates an expense when account exists and currency matches", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(
        makeAccount({
          balanceSnapshotMinor: 100000n,
          balanceSnapshotAt: new Date("2026-09-01T00:00:00Z"),
        }),
      );
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(insertTransaction).mockImplementationOnce(async (tx) => tx);

      const result = await createManualTransaction(testContext, {
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: 4500n, currency: "PLN" },
        payee: "Pharmacy",
        paidByPersonId: validPerson2,
        occurredOn: new Date("2026-09-07T12:00:00Z"),
      });

      expect(isExpense(result)).toBe(true);
      expect(result.householdId).toBe(validHousehold);
      expect(result.amount).toEqual(money(4500n, "PLN"));
      expect((result as { payee: string }).payee).toBe("Pharmacy");
      expect((result as { paidByPersonId: string }).paidByPersonId).toBe(validPerson2);
      expect(insertTransaction).toHaveBeenCalledWith(result);
    });

    it("defaults paidByPersonId to context.personId when omitted", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(insertTransaction).mockImplementationOnce(async (tx) => tx);

      const result = await createManualTransaction(testContext, {
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: 2000n, currency: "PLN" },
        payee: "Coffee Shop",
        occurredOn: new Date("2026-09-07T12:00:00Z"),
      });

      expect((result as { paidByPersonId: string }).paidByPersonId).toBe(validPerson1);
      expect(isPersonInHousehold).not.toHaveBeenCalled();
    });

    it("rejects expense if account not found in household", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(null);

      await expect(
        createManualTransaction(testContext, {
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: 4500n, currency: "PLN" },
          payee: "Pharmacy",
          occurredOn: new Date("2026-09-07T12:00:00Z"),
        }),
      ).rejects.toThrow(TransactionAccountNotFoundError);
    });

    it("rejects expense if account currency mismatches transaction currency", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(
        makeAccount({
          name: "EUR savings",
          type: "savings",
          currency: "EUR",
        }),
      );

      await expect(
        createManualTransaction(testContext, {
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: 4500n, currency: "PLN" },
          payee: "Pharmacy",
          occurredOn: new Date("2026-09-07T12:00:00Z"),
        }),
      ).rejects.toThrow(TransactionCurrencyMismatchError);
    });

    it("rejects expense if paidByPersonId is not a household member", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(false);

      await expect(
        createManualTransaction(testContext, {
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: 4500n, currency: "PLN" },
          payee: "Pharmacy",
          paidByPersonId: validPerson2,
          occurredOn: new Date("2026-09-07T12:00:00Z"),
        }),
      ).rejects.toThrow(TransactionInvalidPersonError);
    });
  });

  describe("createManualTransaction: income", () => {
    it("creates income when account exists and currency matches", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(insertTransaction).mockImplementationOnce(async (tx) => tx);

      const result = await createManualTransaction(testContext, {
        kind: "income",
        accountId: validAccount1,
        amount: { amountMinor: 500000n, currency: "PLN" },
        source: "Salary",
        occurredOn: new Date("2026-09-07T09:00:00Z"),
      });

      expect(isIncome(result)).toBe(true);
      expect((result as { source: string }).source).toBe("Salary");
      expect((result as { receivedByPersonId: string }).receivedByPersonId).toBe(validPerson1);
    });

    it("rejects income if account currency mismatches", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(
        makeAccount({
          name: "USD Account",
          currency: "USD",
        }),
      );

      await expect(
        createManualTransaction(testContext, {
          kind: "income",
          accountId: validAccount1,
          amount: { amountMinor: 500000n, currency: "PLN" },
          source: "Salary",
          occurredOn: new Date("2026-09-07T09:00:00Z"),
        }),
      ).rejects.toThrow(TransactionCurrencyMismatchError);
    });
  });

  describe("createManualTransaction: transfer", () => {
    it("creates transfer when both accounts exist and currencies match", async () => {
      vi.mocked(findAccountInHousehold).mockImplementation(async (_hId, accId) => {
        if (accId === validAccount1) {
          return makeAccount({ id: validAccount1, name: "Checking" });
        }
        if (accId === validAccount2) {
          return makeAccount({ id: validAccount2, name: "Savings", type: "savings" });
        }
        return null;
      });
      vi.mocked(insertTransaction).mockImplementationOnce(async (tx) => tx);

      const result = await createManualTransaction(testContext, {
        kind: "transfer",
        fromAccountId: validAccount1,
        toAccountId: validAccount2,
        amount: { amountMinor: 20000n, currency: "PLN" },
        occurredOn: new Date("2026-09-07T15:00:00Z"),
      });

      expect(isTransfer(result)).toBe(true);
      expect((result as { fromAccountId: string }).fromAccountId).toBe(validAccount1);
      expect((result as { toAccountId: string }).toAccountId).toBe(validAccount2);
    });

    it("rejects transfer if source account not found", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(null);

      await expect(
        createManualTransaction(testContext, {
          kind: "transfer",
          fromAccountId: validAccount1,
          toAccountId: validAccount2,
          amount: { amountMinor: 20000n, currency: "PLN" },
          occurredOn: new Date("2026-09-07T15:00:00Z"),
        }),
      ).rejects.toThrow(TransactionAccountNotFoundError);
    });

    it("rejects transfer if destination account not found", async () => {
      vi.mocked(findAccountInHousehold)
        .mockResolvedValueOnce(makeAccount({ name: "Checking" }))
        .mockResolvedValueOnce(null);

      await expect(
        createManualTransaction(testContext, {
          kind: "transfer",
          fromAccountId: validAccount1,
          toAccountId: validAccount2,
          amount: { amountMinor: 20000n, currency: "PLN" },
          occurredOn: new Date("2026-09-07T15:00:00Z"),
        }),
      ).rejects.toThrow(TransactionAccountNotFoundError);
    });

    it("rejects transfer if account currency does not match transfer currency", async () => {
      vi.mocked(findAccountInHousehold)
        .mockResolvedValueOnce(makeAccount({ name: "Checking" }))
        .mockResolvedValueOnce(
          makeAccount({
            id: validAccount2,
            name: "EUR Savings",
            type: "savings",
            currency: "EUR",
          }),
        );

      await expect(
        createManualTransaction(testContext, {
          kind: "transfer",
          fromAccountId: validAccount1,
          toAccountId: validAccount2,
          amount: { amountMinor: 20000n, currency: "PLN" },
          occurredOn: new Date("2026-09-07T15:00:00Z"),
        }),
      ).rejects.toThrow(TransactionCurrencyMismatchError);
    });
  });

  describe("listManualTransactions", () => {
    it("delegates to listTransactionsByHousehold with authorized householdId", async () => {
      vi.mocked(listTransactionsByHousehold).mockResolvedValueOnce([]);

      const result = await listManualTransactions(testContext, {
        accountId: validAccount1,
        limit: 20,
        offset: 10,
      });

      expect(result).toEqual([]);
      expect(listTransactionsByHousehold).toHaveBeenCalledWith({
        householdId: validHousehold,
        accountId: validAccount1,
        limit: 20,
        offset: 10,
      });
    });
  });

  describe("category assignment and validation", () => {
    const validCategory = "018f47a0-7762-7b9c-8d17-27f2f79e59a9";

    it("assigns category to expense when category is active and applicable to expense", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce({
        id: validCategory,
        householdId: validHousehold,
        name: "Food",
        applicability: "expense",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(insertTransaction).mockImplementationOnce(async (tx) => tx);

      const result = await createManualTransaction(testContext, {
        kind: "expense",
        accountId: validAccount1,
        categoryId: validCategory,
        amount: money(1500n, "PLN"),
        payee: "Supermarket",
        occurredOn: new Date(),
      });

      expect(isExpense(result)).toBe(true);
      if (isExpense(result)) {
        expect(result.categoryId).toBe(validCategory);
      }
    });

    it("assigns category to income when category is active and applicable to income", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce({
        id: validCategory,
        householdId: validHousehold,
        name: "Salary",
        applicability: "income",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(insertTransaction).mockImplementationOnce(async (tx) => tx);

      const result = await createManualTransaction(testContext, {
        kind: "income",
        accountId: validAccount1,
        categoryId: validCategory,
        amount: money(500000n, "PLN"),
        source: "Company",
        occurredOn: new Date(),
      });

      expect(isIncome(result)).toBe(true);
      if (isIncome(result)) {
        expect(result.categoryId).toBe(validCategory);
      }
    });

    it("rejects category assignment when category is not found in household", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce(null);

      await expect(
        createManualTransaction(testContext, {
          kind: "expense",
          accountId: validAccount1,
          categoryId: validCategory,
          amount: money(1500n, "PLN"),
          payee: "Supermarket",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionCategoryNotFoundError);
    });

    it("rejects category assignment when category is archived", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce({
        id: validCategory,
        householdId: validHousehold,
        name: "Old Category",
        applicability: "expense",
        archivedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        createManualTransaction(testContext, {
          kind: "expense",
          accountId: validAccount1,
          categoryId: validCategory,
          amount: money(1500n, "PLN"),
          payee: "Supermarket",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionCategoryArchivedError);
    });

    it("rejects category assignment when category applicability does not match kind", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce({
        id: validCategory,
        householdId: validHousehold,
        name: "Salary",
        applicability: "income",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        createManualTransaction(testContext, {
          kind: "expense",
          accountId: validAccount1,
          categoryId: validCategory,
          amount: money(1500n, "PLN"),
          payee: "Supermarket",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionCategoryApplicabilityError);
    });

    it("rejects category assignment on transfers", async () => {
      vi.mocked(findAccountInHousehold)
        .mockResolvedValueOnce(makeAccount({ id: validAccount1 }))
        .mockResolvedValueOnce(makeAccount({ id: validAccount2 }));

      await expect(
        createManualTransaction(testContext, {
          kind: "transfer",
          fromAccountId: validAccount1,
          toAccountId: validAccount2,
          categoryId: validCategory,
          amount: money(1000n, "PLN"),
          occurredOn: new Date(),
        } as any),
      ).rejects.toThrow(TransactionCategoryNotAllowedError);
    });
  });

  describe("listHouseholdAccounts", () => {
    it("delegates to listAccountsByHousehold with authorized householdId", async () => {
      const mockAccounts = [makeAccount()];
      vi.mocked(listAccountsByHousehold).mockResolvedValueOnce(mockAccounts);

      const result = await listHouseholdAccounts(testContext);

      expect(result).toEqual(mockAccounts);
      expect(listAccountsByHousehold).toHaveBeenCalledWith(validHousehold);
    });
  });

  describe("createManualTransaction: submissionId duplicate prevention", () => {
    it("passes submissionId to insertTransaction when provided", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(insertTransaction).mockImplementationOnce(async (tx) => tx);

      await createManualTransaction(testContext, {
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: 5000n, currency: "PLN" },
        payee: "Bookstore",
        occurredOn: new Date("2026-09-08T10:00:00Z"),
        submissionId: "sub-12345",
      });

      expect(insertTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        { submissionId: "sub-12345" },
      );
    });

    it("propagates DuplicateSubmissionError from database insert", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(insertTransaction).mockRejectedValueOnce(
        new DuplicateSubmissionError("Duplicate submission detected"),
      );

      await expect(
        createManualTransaction(testContext, {
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: 5000n, currency: "PLN" },
          payee: "Bookstore",
          occurredOn: new Date("2026-09-08T10:00:00Z"),
          submissionId: "sub-12345",
        }),
      ).rejects.toThrow(DuplicateSubmissionError);
    });
  });

  describe("getManualTransaction", () => {
    it("returns transaction when found in household", async () => {
      const expense = createExpense({
        id: transactionId(validTxId),
        householdId: validHousehold,
        accountId: accountId(validAccount1),
        amount: money(1200n, "PLN"),
        payee: "Bakery",
        paidByPersonId: validPerson1,
        occurredOn: new Date("2026-09-08T08:00:00Z"),
      });
      vi.mocked(findTransactionById).mockResolvedValueOnce(expense);

      const result = await getManualTransaction(testContext, validTxId);
      expect(result).toBe(expense);
      expect(findTransactionById).toHaveBeenCalledWith(validHousehold, validTxId);
    });

    it("throws TransactionNotFoundError when not found in household", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(null);

      await expect(
        getManualTransaction(testContext, validTxId),
      ).rejects.toThrow(TransactionNotFoundError);
    });
  });

  describe("correctManualTransaction: expense", () => {
    const existingExpense = createExpense({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(2000n, "PLN"),
      payee: "Old Store",
      paidByPersonId: validPerson1,
      occurredOn: new Date("2026-09-08T08:00:00Z"),
      version: 1,
    });

    it("corrects expense and calls updateTransactionInDb with incremented version", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingExpense);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(updateTransactionInDb).mockImplementationOnce(
        async ({ transaction }) => transaction,
      );

      const result = await correctManualTransaction(testContext, validTxId, {
        kind: "expense",
        expectedVersion: 1,
        accountId: validAccount1,
        amount: { amountMinor: 2500n, currency: "PLN" },
        payee: "Updated Store",
        paidByPersonId: validPerson2,
        occurredOn: new Date("2026-09-08T09:00:00Z"),
      });

      expect(isExpense(result)).toBe(true);
      expect(result.version).toBe(2);
      expect(result.amount).toEqual(money(2500n, "PLN"));
      expect((result as { payee: string }).payee).toBe("Updated Store");
      expect(updateTransactionInDb).toHaveBeenCalledWith({
        householdId: validHousehold,
        id: validTxId,
        expectedVersion: 1,
        transaction: expect.objectContaining({
          version: 2,
          payee: "Updated Store",
        }),
      });
    });

    it("throws TransactionNotFoundError when transaction does not exist", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(null);

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "expense",
          expectedVersion: 1,
          accountId: validAccount1,
          amount: { amountMinor: 2500n, currency: "PLN" },
          payee: "Updated Store",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionNotFoundError);
    });

    it("throws TransactionAlreadyVoidedError when transaction is already voided", async () => {
      const voided = voidTransaction(
        existingExpense,
        "Mistake",
        new Date("2026-09-08T09:00:00Z"),
      );
      vi.mocked(findTransactionById).mockResolvedValueOnce(voided);

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "expense",
          expectedVersion: 1,
          accountId: validAccount1,
          amount: { amountMinor: 2500n, currency: "PLN" },
          payee: "Updated Store",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionAlreadyVoidedError);
    });

    it("throws TransactionKindMismatchError when attempting to change kind", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingExpense);

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "transfer",
          expectedVersion: 1,
          fromAccountId: validAccount1,
          toAccountId: validAccount2,
          amount: { amountMinor: 2500n, currency: "PLN" },
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionKindMismatchError);
    });

    it("throws TransactionAccountNotFoundError when account not in household", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingExpense);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(null);

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "expense",
          expectedVersion: 1,
          accountId: validAccount1,
          amount: { amountMinor: 2500n, currency: "PLN" },
          payee: "Updated Store",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionAccountNotFoundError);
    });

    it("throws TransactionCurrencyMismatchError when currency does not match account", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingExpense);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(
        makeAccount({ currency: "PLN" }),
      );

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "expense",
          expectedVersion: 1,
          accountId: validAccount1,
          amount: { amountMinor: 2500n, currency: "EUR" },
          payee: "Updated Store",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionCurrencyMismatchError);
    });

    it("throws TransactionInvalidPersonError when person not in household", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingExpense);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(false);

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "expense",
          expectedVersion: 1,
          accountId: validAccount1,
          amount: { amountMinor: 2500n, currency: "PLN" },
          payee: "Updated Store",
          paidByPersonId: validPerson2,
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionInvalidPersonError);
    });

    it("propagates TransactionVersionConflictError from updateTransactionInDb", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingExpense);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(updateTransactionInDb).mockRejectedValueOnce(
        new TransactionVersionConflictError("Version conflict"),
      );

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "expense",
          expectedVersion: 1,
          accountId: validAccount1,
          amount: { amountMinor: 2500n, currency: "PLN" },
          payee: "Updated Store",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionVersionConflictError);
    });
  });

  describe("correctManualTransaction: income", () => {
    const existingIncome = createIncome({
      id: transactionId(validTxId),
      householdId: validHousehold,
      accountId: accountId(validAccount1),
      amount: money(500000n, "PLN"),
      source: "Salary Old",
      receivedByPersonId: validPerson1,
      occurredOn: new Date("2026-09-08T08:00:00Z"),
      version: 1,
    });

    it("corrects income transaction successfully", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingIncome);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(true);
      vi.mocked(updateTransactionInDb).mockImplementationOnce(
        async ({ transaction }) => transaction,
      );

      const result = await correctManualTransaction(testContext, validTxId, {
        kind: "income",
        expectedVersion: 1,
        accountId: validAccount1,
        amount: { amountMinor: 550000n, currency: "PLN" },
        source: "Salary New",
        receivedByPersonId: validPerson2,
        occurredOn: new Date("2026-09-08T09:00:00Z"),
      });

      expect(isIncome(result)).toBe(true);
      expect(result.version).toBe(2);
      expect((result as { source: string }).source).toBe("Salary New");
    });

    it("rejects income correction with category applicable only to expense", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingIncome);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce(makeAccount());
      vi.mocked(findCategoryInHousehold).mockResolvedValueOnce({
        id: validCategoryId,
        householdId: validHousehold,
        name: "Groceries",
        applicability: "expense",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "income",
          expectedVersion: 1,
          accountId: validAccount1,
          categoryId: validCategoryId,
          amount: { amountMinor: 550000n, currency: "PLN" },
          source: "Bonus",
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionCategoryApplicabilityError);
    });
  });

  describe("correctManualTransaction: transfer", () => {
    const existingTransfer = createTransfer({
      id: transactionId(validTxId),
      householdId: validHousehold,
      fromAccountId: accountId(validAccount1),
      toAccountId: accountId(validAccount2),
      amount: money(30000n, "PLN"),
      occurredOn: new Date("2026-09-08T08:00:00Z"),
      version: 1,
    });

    it("corrects transfer atomically across accounts", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingTransfer);
      vi.mocked(findAccountInHousehold)
        .mockResolvedValueOnce(makeAccount({ id: validAccount1 }))
        .mockResolvedValueOnce(makeAccount({ id: validAccount2 }));
      vi.mocked(updateTransactionInDb).mockImplementationOnce(
        async ({ transaction }) => transaction,
      );

      const result = await correctManualTransaction(testContext, validTxId, {
        kind: "transfer",
        expectedVersion: 1,
        fromAccountId: validAccount1,
        toAccountId: validAccount2,
        amount: { amountMinor: 40000n, currency: "PLN" },
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });

      expect(isTransfer(result)).toBe(true);
      expect(result.version).toBe(2);
      expect(result.amount).toEqual(money(40000n, "PLN"));
    });

    it("rejects transfer correction with self-transfer", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingTransfer);
      vi.mocked(findAccountInHousehold)
        .mockResolvedValueOnce(makeAccount({ id: validAccount1 }))
        .mockResolvedValueOnce(makeAccount({ id: validAccount1 }));

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "transfer",
          expectedVersion: 1,
          fromAccountId: validAccount1,
          toAccountId: validAccount1,
          amount: { amountMinor: 40000n, currency: "PLN" },
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(/Transfer fromAccountId and toAccountId must be different/);
    });

    it("rejects transfer correction when currency mismatches", async () => {
      vi.mocked(findTransactionById).mockResolvedValueOnce(existingTransfer);
      vi.mocked(findAccountInHousehold)
        .mockResolvedValueOnce(makeAccount({ id: validAccount1, currency: "PLN" }))
        .mockResolvedValueOnce(makeAccount({ id: validAccount2, currency: "EUR" }));

      await expect(
        correctManualTransaction(testContext, validTxId, {
          kind: "transfer",
          expectedVersion: 1,
          fromAccountId: validAccount1,
          toAccountId: validAccount2,
          amount: { amountMinor: 40000n, currency: "PLN" },
          occurredOn: new Date(),
        }),
      ).rejects.toThrow(TransactionCurrencyMismatchError);
    });
  });

  describe("voidManualTransaction", () => {
    it("voids active transaction and returns voided entity", async () => {
      const activeExpense = createExpense({
        id: transactionId(validTxId),
        householdId: validHousehold,
        accountId: accountId(validAccount1),
        amount: money(1000n, "PLN"),
        payee: "Wrong Shop",
        paidByPersonId: validPerson1,
        occurredOn: new Date("2026-09-08T08:00:00Z"),
        version: 1,
      });
      const voidedExpense = voidTransaction(
        activeExpense,
        "Duplicate receipt",
        new Date("2026-09-08T11:00:00Z"),
      );
      vi.mocked(voidTransactionInDb).mockResolvedValueOnce(voidedExpense);

      const result = await voidManualTransaction(testContext, validTxId, {
        expectedVersion: 1,
        voidReason: "Duplicate receipt",
      });

      expect(isVoided(result)).toBe(true);
      expect(result.version).toBe(2);
      expect(result.voidReason).toBe("Duplicate receipt");
      expect(voidTransactionInDb).toHaveBeenCalledWith({
        householdId: validHousehold,
        id: validTxId,
        expectedVersion: 1,
        voidReason: "Duplicate receipt",
      });
    });

    it("propagates TransactionVersionConflictError when voiding", async () => {
      vi.mocked(voidTransactionInDb).mockRejectedValueOnce(
        new TransactionVersionConflictError("Version conflict"),
      );

      await expect(
        voidManualTransaction(testContext, validTxId, {
          expectedVersion: 1,
        }),
      ).rejects.toThrow(TransactionVersionConflictError);
    });
  });

  describe("balance snapshot preservation", () => {
    it("preserves account balance snapshot when creating, correcting, or voiding transactions", async () => {
      const snapshotMinor = 500000n;
      const snapshotAt = new Date("2026-09-01T00:00:00Z");
      const accountWithSnapshot = makeAccount({
        balanceSnapshotMinor: snapshotMinor,
        balanceSnapshotAt: snapshotAt,
      });

      vi.mocked(findAccountInHousehold).mockResolvedValue(accountWithSnapshot);
      vi.mocked(isPersonInHousehold).mockResolvedValue(true);
      vi.mocked(insertTransaction).mockImplementation(async (tx) => tx);

      // Create transaction
      const created = await createManualTransaction(testContext, {
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: 2000n, currency: "PLN" },
        payee: "Test Store",
        occurredOn: new Date(),
      });
      expect(created).toBeDefined();

      // Verify the account snapshot retrieved from DB was not altered
      const currentAccount = await findAccountInHousehold(
        validHousehold,
        validAccount1,
      );
      expect(currentAccount?.balanceSnapshotMinor).toBe(snapshotMinor);
      expect(currentAccount?.balanceSnapshotAt).toBe(snapshotAt);

      // Correct transaction
      vi.mocked(findTransactionById).mockResolvedValueOnce(created);
      vi.mocked(updateTransactionInDb).mockImplementationOnce(
        async ({ transaction }) => transaction,
      );
      const corrected = await correctManualTransaction(testContext, created.id, {
        kind: "expense",
        expectedVersion: 1,
        accountId: validAccount1,
        amount: { amountMinor: 3000n, currency: "PLN" },
        payee: "Test Store Corrected",
        occurredOn: new Date(),
      });
      expect(corrected.version).toBe(2);
      expect(currentAccount?.balanceSnapshotMinor).toBe(snapshotMinor);
      expect(currentAccount?.balanceSnapshotAt).toBe(snapshotAt);

      // Void transaction
      const voided = voidTransaction(corrected, "Void test", new Date());
      vi.mocked(voidTransactionInDb).mockResolvedValueOnce(voided);
      const voidResult = await voidManualTransaction(testContext, created.id, {
        expectedVersion: 2,
        voidReason: "Void test",
      });
      expect(isVoided(voidResult)).toBe(true);

      // Balance snapshot is intact throughout
      expect(currentAccount?.balanceSnapshotMinor).toBe(snapshotMinor);
      expect(currentAccount?.balanceSnapshotAt).toBe(snapshotAt);
    });
  });
});
