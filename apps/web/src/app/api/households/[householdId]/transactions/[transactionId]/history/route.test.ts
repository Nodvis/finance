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
    getTransactionHistory: vi.fn(),
  };
});

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  TransactionNotFoundError,
  getTransactionHistory,
} from "@/lib/transactions/service";
import type { TransactionHistoryResult } from "@/lib/transactions/service";
import { householdId, personId } from "@nodvis/finance-domain";

import { GET } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validTxId = "018f47a0-7762-7b9c-8d17-27f2f79e59a5";

const authorizedContext = {
  authUserId: "018f47a0-7762-7b9c-8d17-27f2f79e59a0",
  householdId: householdId(validHousehold),
  personId: personId(validPerson),
};

describe("Transactions History [transactionId]/history API Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/households/[householdId]/transactions/[transactionId]/history", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/history`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Authentication is required" });
    });

    it("returns 403 when household access is denied (cross-household denial)", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/history`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({ error: "Household access denied" });
    });

    it("returns 404 when transaction is not found in household", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      vi.mocked(getTransactionHistory).mockRejectedValueOnce(
        new TransactionNotFoundError(`Transaction ${validTxId} not found in household`),
      );

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/history`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toEqual({
        error: `Transaction ${validTxId} not found in household`,
      });
      expect(getTransactionHistory).toHaveBeenCalledWith(authorizedContext, validTxId);
    });

    it("returns 200 with history payload when authorized", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(authorizedContext);
      const mockResult: TransactionHistoryResult = {
        transactionId: validTxId,
        history: [
          {
            id: "hist-1",
            revision: 1,
            operation: "create",
            source: "manual",
            recordedAt: "2026-09-08T10:00:00.000Z",
            actor: {
              authUserId: authorizedContext.authUserId,
              personId: validPerson,
              displayName: "Alice",
            },
            voidReason: null,
            isBaseline: false,
            changes: [
              {
                field: "amount",
                fieldLabelKey: "fieldAmount",
                before: null,
                after: "50.00 PLN",
              },
            ],
            summary: {
              kind: "expense",
              amountFormatted: "50.00 PLN",
              occurredOn: "2026-09-08",
              accountName: "Main checking",
              fromAccountName: null,
              toAccountName: null,
              categoryName: "Food",
              counterparty: "Store",
              personName: "Alice",
              status: "active",
            },
          },
        ],
      };

      vi.mocked(getTransactionHistory).mockResolvedValueOnce(mockResult);

      const req = new Request(
        `http://localhost/api/households/${validHousehold}/transactions/${validTxId}/history`,
      );
      const response = await GET(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          transactionId: validTxId,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ data: mockResult });
      expect(requireHouseholdAccess).toHaveBeenCalledWith(validHousehold);
      expect(getTransactionHistory).toHaveBeenCalledWith(authorizedContext, validTxId);
    });
  });
});
