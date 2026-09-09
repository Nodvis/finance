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
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {},
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("@/lib/liabilities/service", () => ({
  LiabilityNotFoundError: class LiabilityNotFoundError extends Error {
    constructor(message: string = "Liability not found") {
      super(message);
      this.name = "LiabilityNotFoundError";
    }
  },
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
  getHouseholdLiability: vi.fn(),
  updateHouseholdLiabilityEntry: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  LiabilityNotFoundError,
  getHouseholdLiability,
  updateHouseholdLiabilityEntry,
} from "@/lib/liabilities/service";
import { GET, PATCH } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validLiability = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/liabilities/[liabilityId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 404 when liability does not exist", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(getHouseholdLiability).mockRejectedValueOnce(
        new LiabilityNotFoundError(),
      );

      const res = await GET(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities/${validLiability}`),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            liabilityId: validLiability,
          }),
        },
      );

      expect(res.status).toBe(404);
    });

    it("returns 200 with liability data", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(getHouseholdLiability).mockResolvedValueOnce({
        id: validLiability,
        householdId: validHousehold,
        name: "Home Mortgage",
        kind: "mortgage",
        currency: "PLN",
        observedOutstandingMinor: 35000000n,
        observedOutstandingAt: new Date("2026-09-01T00:00:00Z"),
        responsiblePersonId: null,
        responsiblePersonName: null,
        lender: "PKO BP",
        destinationAccountId: null,
        destinationAccountName: null,
        notes: null,
        version: 1,
        archivedAt: null,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-01T00:00:00Z"),
      });

      const res = await GET(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities/${validLiability}`),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            liabilityId: validLiability,
          }),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(validLiability);
      expect(json.data.observedOutstandingMinor).toBe("35000000");
    });
  });

  describe("PATCH", () => {
    it("updates liability metadata and returns 200", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(updateHouseholdLiabilityEntry).mockResolvedValueOnce({
        id: validLiability,
        householdId: validHousehold,
        name: "Renamed Mortgage",
        kind: "mortgage",
        currency: "PLN",
        observedOutstandingMinor: 35000000n,
        observedOutstandingAt: new Date("2026-09-01T00:00:00Z"),
        responsiblePersonId: null,
        responsiblePersonName: null,
        lender: "PKO BP",
        destinationAccountId: null,
        destinationAccountName: null,
        notes: "Updated note",
        version: 2,
        archivedAt: null,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-02T00:00:00Z"),
      });

      const res = await PATCH(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities/${validLiability}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Renamed Mortgage",
            notes: "Updated note",
            expectedVersion: 1,
          }),
        }),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            liabilityId: validLiability,
          }),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Renamed Mortgage");
      expect(json.data.version).toBe(2);
    });
  });
});
