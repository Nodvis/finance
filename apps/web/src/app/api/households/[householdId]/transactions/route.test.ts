import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../../../../lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

vi.mock("../../../../../lib/authorization/household", () => ({
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {
    constructor() {
      super("Household access denied");
      this.name = "HouseholdAccessDeniedError";
    }
  },
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("../../../../../lib/transactions/service", () => ({
  createManualTransaction: vi.fn(),
  listManualTransactions: vi.fn(),
  TransactionAccountNotFoundError: class TransactionAccountNotFoundError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "TransactionAccountNotFoundError";
    }
  },
  TransactionCurrencyMismatchError: class TransactionCurrencyMismatchError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "TransactionCurrencyMismatchError";
    }
  },
  TransactionInvalidPersonError: class TransactionInvalidPersonError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "TransactionInvalidPersonError";
    }
  },
}));

import { AuthenticationRequiredError } from "../../../../../lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "../../../../../lib/authorization/household";
import {
  createManualTransaction,
  listManualTransactions,
  TransactionAccountNotFoundError,
  TransactionCurrencyMismatchError,
} from "../../../../../lib/transactions/service";
import {
  accountId,
  createExpense,
  createTransfer,
  householdId,
  money,
  personId,
  transactionId,
} from "@nodvis/finance-domain";

import { GET, POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validAccount1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const validAccount2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";
const validTxId = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";

describe("Transactions API Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const authorizedContext = {
    authUserId: "auth-user-1",
    householdId: householdId(validHousehold),
    personId: personId(validPerson),
  };

  describe("POST /api/households/[householdId]/transactions", () => {
    it("returns 401 when authentication is missing", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const req = new Request("http://localhost/api/households/any/transactions", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Authentication is required");
    });

    it("returns 403 when user does not have access to household", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request("http://localhost/api/households/any/transactions", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Household access denied");
    });

    it("returns 400 when request body is invalid JSON", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const req = new Request("http://localhost/api/households/any/transactions", {
        method: "POST",
        body: "not-json{",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Invalid JSON body");
    });

    it("returns 400 when body fails Zod schema validation", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const req = new Request("http://localhost/api/households/any/transactions", {
        method: "POST",
        body: JSON.stringify({
          kind: "expense",
          accountId: "not-a-uuid",
          amount: { amountMinor: "-100", currency: "INVALID" },
          payee: "",
          occurredOn: "invalid-date",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Validation error");
      expect(json.issues).toBeDefined();
    });

    it("returns 400 when service throws business error (e.g. account not found or currency mismatch)", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      vi.mocked(createManualTransaction).mockRejectedValueOnce(
        new TransactionAccountNotFoundError("Account not found in household"),
      );

      const req = new Request("http://localhost/api/households/any/transactions", {
        method: "POST",
        body: JSON.stringify({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "4500", currency: "PLN" },
          payee: "Grocery Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Account not found in household");
    });

    it("returns 201 with serialized transaction when expense is created successfully", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const domainExpense = createExpense({
        id: transactionId(validTxId),
        householdId: householdId(validHousehold),
        accountId: accountId(validAccount1),
        amount: money(4500n, "PLN"),
        payee: "Grocery Store",
        paidByPersonId: personId(validPerson),
        occurredOn: new Date("2026-09-07T12:00:00Z"),
      });
      vi.mocked(createManualTransaction).mockResolvedValueOnce(domainExpense);

      const req = new Request("http://localhost/api/households/any/transactions", {
        method: "POST",
        body: JSON.stringify({
          kind: "expense",
          accountId: validAccount1,
          amount: { amountMinor: "4500", currency: "PLN" },
          payee: "Grocery Store",
          occurredOn: "2026-09-07T12:00:00Z",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data).toEqual({
        id: validTxId,
        householdId: validHousehold,
        kind: "expense",
        accountId: validAccount1,
        amount: { amountMinor: "4500", currency: "PLN" },
        payee: "Grocery Store",
        paidByPersonId: validPerson,
        occurredOn: "2026-09-07T12:00:00.000Z",
      });
    });

    it("returns 201 with serialized transaction when transfer is created successfully", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const domainTransfer = createTransfer({
        id: transactionId(validTxId),
        householdId: householdId(validHousehold),
        fromAccountId: accountId(validAccount1),
        toAccountId: accountId(validAccount2),
        amount: money(50000n, "PLN"),
        occurredOn: new Date("2026-09-07T14:00:00Z"),
      });
      vi.mocked(createManualTransaction).mockResolvedValueOnce(domainTransfer);

      const req = new Request("http://localhost/api/households/any/transactions", {
        method: "POST",
        body: JSON.stringify({
          kind: "transfer",
          fromAccountId: validAccount1,
          toAccountId: validAccount2,
          amountMinor: "50000",
          currency: "PLN",
          occurredOn: "2026-09-07T14:00:00Z",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data).toEqual({
        id: validTxId,
        householdId: validHousehold,
        kind: "transfer",
        fromAccountId: validAccount1,
        toAccountId: validAccount2,
        amount: { amountMinor: "50000", currency: "PLN" },
        occurredOn: "2026-09-07T14:00:00.000Z",
      });
    });
  });

  describe("GET /api/households/[householdId]/transactions", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const req = new Request("http://localhost/api/households/any/transactions");
      const response = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 403 when user does not have access to household", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request("http://localhost/api/households/any/transactions");
      const response = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(403);
    });

    it("returns 400 when query parameters are invalid", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const req = new Request(
        "http://localhost/api/households/any/transactions?limit=200",
      );
      const response = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 200 with serialized transactions list", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

      const domainExpense = createExpense({
        id: transactionId(validTxId),
        householdId: householdId(validHousehold),
        accountId: accountId(validAccount1),
        amount: money(1500n, "PLN"),
        payee: "Coffee",
        paidByPersonId: personId(validPerson),
        occurredOn: new Date("2026-09-07T11:00:00Z"),
      });
      vi.mocked(listManualTransactions).mockResolvedValueOnce([domainExpense]);

      const req = new Request(
        `http://localhost/api/households/any/transactions?accountId=${validAccount1}&limit=10&offset=0`,
      );
      const response = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].amount.amountMinor).toBe("1500");
      expect(json.data[0].amount.currency).toBe("PLN");
      expect(listManualTransactions).toHaveBeenCalledWith(authorizedContext, {
        accountId: validAccount1,
        limit: 10,
        offset: 0,
      });
    });
  });
});
