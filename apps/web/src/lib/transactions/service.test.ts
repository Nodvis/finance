import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  findAccountInHousehold: vi.fn(),
  insertTransaction: vi.fn(),
  isPersonInHousehold: vi.fn(),
  listAccountsByHousehold: vi.fn(),
  listTransactionsByHousehold: vi.fn(),
}));

import {
  findAccountInHousehold,
  insertTransaction,
  isPersonInHousehold,
  listAccountsByHousehold,
  listTransactionsByHousehold,
} from "@nodvis/finance-db";
import {
  householdId,
  isExpense,
  isIncome,
  isTransfer,
  money,
  personId,
} from "@nodvis/finance-domain";

import {
  createManualTransaction,
  listHouseholdAccounts,
  listManualTransactions,
  TransactionAccountNotFoundError,
  TransactionCurrencyMismatchError,
  TransactionInvalidPersonError,
} from "./service";
import type { AuthorizedHouseholdContext } from "./service";

const validHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
const validPerson1 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
const validPerson2 = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a3");
const validAccount1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
const validAccount2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";

const testContext: AuthorizedHouseholdContext = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson1,
};

describe("transaction-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe("createManualTransaction: expense", () => {
    it("creates an expense when account exists and currency matches", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: validAccount1,
        householdId: validHousehold,
        name: "Main checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 100000n,
        balanceSnapshotAt: new Date("2026-09-01T00:00:00Z"),
      });
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
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: validAccount1,
        householdId: validHousehold,
        name: "Main checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
      });
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
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: validAccount1,
        householdId: validHousehold,
        name: "EUR savings",
        type: "savings",
        currency: "EUR",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
      });

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
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: validAccount1,
        householdId: validHousehold,
        name: "Main checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
      });
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
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: validAccount1,
        householdId: validHousehold,
        name: "Main checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
      });
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
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: validAccount1,
        householdId: validHousehold,
        name: "USD Account",
        type: "checking",
        currency: "USD",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
      });

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
          return {
            id: validAccount1,
            householdId: validHousehold,
            name: "Checking",
            type: "checking",
            currency: "PLN",
            balanceSnapshotMinor: null,
            balanceSnapshotAt: null,
          };
        }
        if (accId === validAccount2) {
          return {
            id: validAccount2,
            householdId: validHousehold,
            name: "Savings",
            type: "savings",
            currency: "PLN",
            balanceSnapshotMinor: null,
            balanceSnapshotAt: null,
          };
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
        .mockResolvedValueOnce({
          id: validAccount1,
          householdId: validHousehold,
          name: "Checking",
          type: "checking",
          currency: "PLN",
          balanceSnapshotMinor: null,
          balanceSnapshotAt: null,
        })
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
        .mockResolvedValueOnce({
          id: validAccount1,
          householdId: validHousehold,
          name: "Checking",
          type: "checking",
          currency: "PLN",
          balanceSnapshotMinor: null,
          balanceSnapshotAt: null,
        })
        .mockResolvedValueOnce({
          id: validAccount2,
          householdId: validHousehold,
          name: "EUR Savings",
          type: "savings",
          currency: "EUR",
          balanceSnapshotMinor: null,
          balanceSnapshotAt: null,
        });

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

  describe("listHouseholdAccounts", () => {
    it("delegates to listAccountsByHousehold with authorized householdId", async () => {
      const mockAccounts = [
        {
          id: validAccount1,
          householdId: validHousehold,
          name: "Main checking",
          type: "checking" as const,
          currency: "PLN",
        },
      ];
      vi.mocked(listAccountsByHousehold).mockResolvedValueOnce(mockAccounts);

      const result = await listHouseholdAccounts(testContext);

      expect(result).toEqual(mockAccounts);
      expect(listAccountsByHousehold).toHaveBeenCalledWith(validHousehold);
    });
  });
});
