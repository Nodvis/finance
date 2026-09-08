import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

vi.mock("@/lib/authorization/household", () => ({
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {
    constructor() {
      super("Household access denied");
      this.name = "HouseholdAccessDeniedError";
    }
  },
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("@/lib/transactions/service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/transactions/service")>();
  return {
    ...actual,
    getManualTransaction: vi.fn(),
    correctManualTransaction: vi.fn(),
  };
});

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  TransactionAlreadyVoidedError,
  TransactionCurrencyMismatchError,
  TransactionKindMismatchError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  correctManualTransaction,
  getManualTransaction,
} from "@/lib/transactions/service";
import {
  accountId,
  createExpense,
  createTransfer,
  householdId,
  money,
  personId,
  transactionId,
} from "@nodvis/finance-domain";

import { GET, PATCH } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validAccount1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const validAccount2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
const validTxId = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";

const authorizedContext = {
  authUserId: "018f47a0-7762-7b9c-8d17-27f2f79e59a0",
  householdId: householdId(validHousehold),
  personId: personId(validPerson),
};

describe("Transactions [transactionId] API Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/households/[householdId]/transactions/[transactionId]", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 403 when access denied to household", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(403);
    });

    it("returns 404 when transaction is not found", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      vi.mocked(getManualTransaction).mockRejectedValueOnce(
        new TransactionNotFoundError("Transaction not found"),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toContain("not found");
    });

    it("returns 200 with serialized transaction details", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const domainExpense = createExpense({
        id: transactionId(validTxId),
        householdId: householdId(validHousehold),
        accountId: accountId(validAccount1),
        amount: money(2500n, "PLN"),
        payee: "Cafe",
        paidByPersonId: personId(validPerson),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });
      vi.mocked(getManualTransaction).mockResolvedValueOnce(domainExpense);

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toEqual({
        id: validTxId,
        householdId: validHousehold,
        kind: "expense",
        accountId: validAccount1,
        categoryId: null,
        amount: { amountMinor: "2500", currency: "PLN" },
        payee: "Cafe",
        paidByPersonId: validPerson,
        occurredOn: "2026-09-08T10:00:00.000Z",
        version: 1,
        voidedAt: null,
        voidReason: null,
      });
      expect(getManualTransaction).toHaveBeenCalledWith(
        authorizedContext,
        validTxId,
      );
    });
  });

  describe("PATCH /api/households/[householdId]/transactions/[transactionId]", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "expense",
            expectedVersion: 1,
            accountId: validAccount1,
            amountMinor: "3000",
            currency: "PLN",
            payee: "Store",
            paidByPersonId: validPerson,
            occurredOn: "2026-09-08T10:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 400 for invalid JSON body", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: "invalid-json{",
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Invalid JSON body");
    });

    it("returns 400 for validation failure (missing expectedVersion)", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "expense",
            accountId: validAccount1,
            amountMinor: "3000",
            currency: "PLN",
            payee: "Store",
            paidByPersonId: validPerson,
            occurredOn: "2026-09-08T10:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Validation error");
    });

    it("returns 409 on version conflict", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      vi.mocked(correctManualTransaction).mockRejectedValueOnce(
        new TransactionVersionConflictError("Transaction was modified concurrently"),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "expense",
            expectedVersion: 1,
            accountId: validAccount1,
            amountMinor: "3000",
            currency: "PLN",
            payee: "Store",
            paidByPersonId: validPerson,
            occurredOn: "2026-09-08T10:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(409);
    });

    it("returns 400 when transaction is already voided", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      vi.mocked(correctManualTransaction).mockRejectedValueOnce(
        new TransactionAlreadyVoidedError("Transaction is already voided"),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "expense",
            expectedVersion: 1,
            accountId: validAccount1,
            amountMinor: "3000",
            currency: "PLN",
            payee: "Store",
            paidByPersonId: validPerson,
            occurredOn: "2026-09-08T10:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("voided");
    });

    it("returns 400 when kind mismatches existing transaction", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      vi.mocked(correctManualTransaction).mockRejectedValueOnce(
        new TransactionKindMismatchError("Cannot change transaction kind"),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "transfer",
            expectedVersion: 1,
            fromAccountId: validAccount1,
            toAccountId: validAccount2,
            amountMinor: "3000",
            currency: "PLN",
            occurredOn: "2026-09-08T10:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Cannot change transaction kind");
    });

    it("returns 400 on currency mismatch", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      vi.mocked(correctManualTransaction).mockRejectedValueOnce(
        new TransactionCurrencyMismatchError("Account currency does not match transaction currency"),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "expense",
            expectedVersion: 1,
            accountId: validAccount1,
            amountMinor: "3000",
            currency: "EUR",
            payee: "Store",
            paidByPersonId: validPerson,
            occurredOn: "2026-09-08T10:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 200 with updated serialized expense", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const updatedExpense = createExpense({
        id: transactionId(validTxId),
        householdId: householdId(validHousehold),
        accountId: accountId(validAccount1),
        amount: money(3500n, "PLN"),
        payee: "Corrected Store",
        paidByPersonId: personId(validPerson),
        occurredOn: new Date("2026-09-08T12:00:00Z"),
        version: 2,
      });
      vi.mocked(correctManualTransaction).mockResolvedValueOnce(updatedExpense);

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "expense",
            expectedVersion: 1,
            accountId: validAccount1,
            amountMinor: "3500",
            currency: "PLN",
            payee: "Corrected Store",
            paidByPersonId: validPerson,
            occurredOn: "2026-09-08T12:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toEqual({
        id: validTxId,
        householdId: validHousehold,
        kind: "expense",
        accountId: validAccount1,
        categoryId: null,
        amount: { amountMinor: "3500", currency: "PLN" },
        payee: "Corrected Store",
        paidByPersonId: validPerson,
        occurredOn: "2026-09-08T12:00:00.000Z",
        version: 2,
        voidedAt: null,
        voidReason: null,
      });
      expect(correctManualTransaction).toHaveBeenCalledWith(
        authorizedContext,
        validTxId,
        expect.objectContaining({
          kind: "expense",
          expectedVersion: 1,
        }),
      );
    });

    it("returns 200 with updated serialized transfer", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const updatedTransfer = createTransfer({
        id: transactionId(validTxId),
        householdId: householdId(validHousehold),
        fromAccountId: accountId(validAccount1),
        toAccountId: accountId(validAccount2),
        amount: money(75000n, "PLN"),
        occurredOn: new Date("2026-09-08T15:00:00Z"),
        version: 2,
      });
      vi.mocked(correctManualTransaction).mockResolvedValueOnce(updatedTransfer);

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            kind: "transfer",
            expectedVersion: 1,
            fromAccountId: validAccount1,
            toAccountId: validAccount2,
            amountMinor: "75000",
            currency: "PLN",
            occurredOn: "2026-09-08T15:00:00Z",
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await PATCH(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toEqual({
        id: validTxId,
        householdId: validHousehold,
        kind: "transfer",
        fromAccountId: validAccount1,
        toAccountId: validAccount2,
        amount: { amountMinor: "75000", currency: "PLN" },
        occurredOn: "2026-09-08T15:00:00.000Z",
        version: 2,
        voidedAt: null,
        voidReason: null,
      });
    });
  });
});
