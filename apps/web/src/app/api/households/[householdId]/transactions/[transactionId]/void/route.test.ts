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
    voidManualTransaction: vi.fn(),
  };
});

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  TransactionAlreadyVoidedError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  voidManualTransaction,
} from "@/lib/transactions/service";
import {
  accountId,
  createExpense,
  householdId,
  money,
  personId,
  transactionId,
  voidTransaction,
} from "@nodvis/finance-domain";

import { POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validAccount1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const validTxId = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";

const authorizedContext = {
  authUserId: "018f47a0-7762-7b9c-8d17-27f2f79e59a0",
  householdId: householdId(validHousehold),
  personId: personId(validPerson),
};

describe("POST /api/households/[householdId]/transactions/[transactionId]/void", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/void`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1 }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(req, {
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
      `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/void`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1 }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(req, {
      params: Promise.resolve({
        householdId: validHousehold,
        transactionId: validTxId,
      }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 404 when transaction not found", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
    vi.mocked(voidManualTransaction).mockRejectedValueOnce(
      new TransactionNotFoundError(validTxId),
    );

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/void`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1 }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(req, {
      params: Promise.resolve({
        householdId: validHousehold,
        transactionId: validTxId,
      }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 409 on version conflict", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
    vi.mocked(voidManualTransaction).mockRejectedValueOnce(
      new TransactionVersionConflictError("Transaction was modified concurrently"),
    );

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/void`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1 }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(req, {
      params: Promise.resolve({
        householdId: validHousehold,
        transactionId: validTxId,
      }),
    });

    expect(response.status).toBe(409);
  });

  it("returns 400 when transaction is already voided", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
    vi.mocked(voidManualTransaction).mockRejectedValueOnce(
      new TransactionAlreadyVoidedError(validTxId),
    );

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/void`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1 }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(req, {
      params: Promise.resolve({
        householdId: validHousehold,
        transactionId: validTxId,
      }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when expectedVersion is missing", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/void`,
      {
        method: "POST",
        body: JSON.stringify({ voidReason: "Entered by mistake" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(req, {
      params: Promise.resolve({
        householdId: validHousehold,
        transactionId: validTxId,
      }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation error");
  });

  it("returns 200 with voided transaction when voiding succeeds", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);

    const baseExpense = createExpense({
      id: transactionId(validTxId),
      householdId: householdId(validHousehold),
      accountId: accountId(validAccount1),
      amount: money(2000n, "PLN"),
      payee: "Accidental Store",
      paidByPersonId: personId(validPerson),
      occurredOn: new Date("2026-09-08T09:00:00Z"),
      version: 1,
    });
    const voidTime = new Date("2026-09-08T11:00:00Z");
    const voidedExpense = voidTransaction(
      baseExpense,
      "Duplicate entry",
      voidTime,
    );
    vi.mocked(voidManualTransaction).mockResolvedValueOnce(voidedExpense);

    const req = new Request(
      `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/void`,
      {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 1,
          voidReason: "Duplicate entry",
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(req, {
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
      amount: { amountMinor: "2000", currency: "PLN" },
      payee: "Accidental Store",
      paidByPersonId: validPerson,
      occurredOn: "2026-09-08T09:00:00.000Z",
      version: 2,
      voidedAt: "2026-09-08T11:00:00.000Z",
      voidReason: "Duplicate entry",
    });
    expect(voidManualTransaction).toHaveBeenCalledWith(
      authorizedContext,
      validTxId,
      {
        expectedVersion: 1,
        voidReason: "Duplicate entry",
      },
    );
  });
});
