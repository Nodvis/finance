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

vi.mock("@/lib/obligations/service", () => ({
  ObligationNotFoundError: class ObligationNotFoundError extends Error {},
  ObligationVersionConflictError: class ObligationVersionConflictError extends Error {},
  ObligationValidationError: class ObligationValidationError extends Error {},
  ObligationMatchConflictError: class ObligationMatchConflictError extends Error {},
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {},
  listHouseholdObligations: vi.fn(),
  createHouseholdObligation: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  createHouseholdObligation,
  listHouseholdObligations,
} from "@/lib/obligations/service";
import { GET, POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/obligations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
  });

  describe("GET", () => {
    it("returns 401 when authentication is missing", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValue(
        new AuthenticationRequiredError(),
      );

      const response = await GET(
        new Request(`http://localhost/api/households/${validHousehold}/obligations`),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(response.status).toBe(401);
    });

    it("returns 403 when access is denied", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValue(
        new HouseholdAccessDeniedError(),
      );

      const response = await GET(
        new Request(`http://localhost/api/households/${validHousehold}/obligations`),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(response.status).toBe(403);
    });

    it("returns obligations list successfully", async () => {
      vi.mocked(listHouseholdObligations).mockResolvedValue([
        {
          id: "ob-1",
          householdId: validHousehold,
          title: "Phone",
          amountMinor: "5000",
          currency: "PLN",
          dueDate: "2026-09-15",
          notes: null,
          transactionId: null,
          version: 1,
          status: "upcoming",
          cancelledAt: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ]);

      const response = await GET(
        new Request(`http://localhost/api/households/${validHousehold}/obligations?status=upcoming`),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Phone");
    });
  });

  describe("POST", () => {
    it("creates an obligation and returns 201", async () => {
      vi.mocked(createHouseholdObligation).mockResolvedValue({
        id: "ob-1",
        householdId: validHousehold,
        title: "Internet",
        amountMinor: "12000",
        currency: "PLN",
        dueDate: "2026-09-20",
        notes: null,
        transactionId: null,
        version: 1,
        status: "upcoming",
        cancelledAt: null,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      });

      const response = await POST(
        new Request(`http://localhost/api/households/${validHousehold}/obligations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Internet",
            amountMinor: "12000",
            currency: "PLN",
            dueDate: "2026-09-20",
          }),
        }),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.title).toBe("Internet");
    });

    it("validates input schema and returns 400 on invalid payload", async () => {
      const response = await POST(
        new Request(`http://localhost/api/households/${validHousehold}/obligations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "", // invalid empty title
            amountMinor: "12000",
            currency: "PLN",
            dueDate: "2026-09-20",
          }),
        }),
        { params: Promise.resolve({ householdId: validHousehold }) },
      );

      expect(response.status).toBe(400);
    });
  });
});
