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

vi.mock("@/lib/liabilities/service", () => ({
  LiabilityNotFoundError: class LiabilityNotFoundError extends Error {},
  LiabilityVersionConflictError: class LiabilityVersionConflictError extends Error {},
  LiabilityDestinationAccountNotFoundError: class LiabilityDestinationAccountNotFoundError extends Error {},
  LiabilityDestinationAccountCurrencyMismatchError: class LiabilityDestinationAccountCurrencyMismatchError extends Error {},
  LiabilityDestinationAccountInvalidHouseholdError: class LiabilityDestinationAccountInvalidHouseholdError extends Error {},
  LiabilityRepaymentNotFoundError: class LiabilityRepaymentNotFoundError extends Error {},
  LiabilityRepaymentAlreadyVoidedError: class LiabilityRepaymentAlreadyVoidedError extends Error {},
  LiabilityRepaymentVersionConflictError: class LiabilityRepaymentVersionConflictError extends Error {},
  LiabilityRepaymentSourceAccountNotFoundError: class LiabilityRepaymentSourceAccountNotFoundError extends Error {},
  LiabilityRepaymentSourceAccountCurrencyMismatchError: class LiabilityRepaymentSourceAccountCurrencyMismatchError extends Error {},
  LiabilityInvalidResponsiblePersonError: class LiabilityInvalidResponsiblePersonError extends Error {},
  LiabilityRepaymentInvalidAllocationError: class LiabilityRepaymentInvalidAllocationError extends Error {},
  createHouseholdLiabilityEntry: vi.fn(),
  listHouseholdLiabilities: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  createHouseholdLiabilityEntry,
  listHouseholdLiabilities,
} from "@/lib/liabilities/service";
import { GET, POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validLiability = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/liabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when authentication is missing", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const res = await GET(
        new Request("http://localhost/api/households/h-1/liabilities"),
        { params: Promise.resolve({ householdId: "h-1" }) },
      );

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Authentication is required");
    });

    it("returns 403 when household access is denied", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new HouseholdAccessDeniedError(),
      );

      const res = await GET(
        new Request("http://localhost/api/households/h-1/liabilities"),
        { params: Promise.resolve({ householdId: "h-1" }) },
      );

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Household access denied");
    });

    it("returns 200 with serialized liabilities on success", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(listHouseholdLiabilities).mockResolvedValueOnce([
        {
          id: validLiability,
          householdId: validHousehold,
          name: "Home Mortgage",
          kind: "mortgage",
          currency: "PLN",
          observedOutstandingMinor: 45000000n,
          observedOutstandingAt: new Date("2026-09-01T00:00:00Z"),
          responsiblePersonId: null,
          responsiblePersonName: null,
          lender: "Bank XYZ",
          destinationAccountId: null,
          destinationAccountName: null,
          notes: null,
          version: 1,
          archivedAt: null,
          createdAt: new Date("2026-09-01T00:00:00Z"),
          updatedAt: new Date("2026-09-01T00:00:00Z"),
        },
      ]);

      const res = await GET(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities`),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe(validLiability);
      expect(json.data[0].observedOutstandingMinor).toBe("45000000");
    });
  });

  describe("POST", () => {
    it("returns 400 on validation error for missing name", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );

      const res = await POST(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currency: "PLN",
          }),
        }),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation error");
    });

    it("returns 201 on successful liability creation", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(createHouseholdLiabilityEntry).mockResolvedValueOnce({
        id: validLiability,
        householdId: validHousehold,
        name: "Auto Loan",
        kind: "loan",
        currency: "PLN",
        observedOutstandingMinor: null,
        observedOutstandingAt: null,
        responsiblePersonId: null,
        responsiblePersonName: null,
        lender: "AutoBank",
        destinationAccountId: null,
        destinationAccountName: null,
        notes: null,
        version: 1,
        archivedAt: null,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-01T00:00:00Z"),
      });

      const res = await POST(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Auto Loan",
            kind: "loan",
            currency: "PLN",
            lender: "AutoBank",
          }),
        }),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.id).toBe(validLiability);
      expect(json.data.name).toBe("Auto Loan");
    });
  });
});
