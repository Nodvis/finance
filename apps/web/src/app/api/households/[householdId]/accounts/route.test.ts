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

vi.mock("@/lib/accounts/service", () => ({
  AccountInvalidOwnerError: class AccountInvalidOwnerError extends Error {
    constructor(message: string = "All account owners must belong to this household") {
      super(message);
      this.name = "AccountInvalidOwnerError";
    }
  },
  listHouseholdAccountsSummary: vi.fn(),
  createHouseholdAccountEntry: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  AccountInvalidOwnerError,
  createHouseholdAccountEntry,
  listHouseholdAccountsSummary,
} from "@/lib/accounts/service";
import { GET, POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
};

describe("/api/households/[householdId]/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new AuthenticationRequiredError(),
      );

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts`);
      const res = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Authentication is required");
    });

    it("returns 403 when access denied", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts`);
      const res = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Household access denied");
    });

    it("returns 200 with accounts list when authorized", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
      const mockAccounts = [
        {
          id: "acc-1",
          householdId: validHousehold,
          name: "Main checking",
          type: "checking",
          currency: "PLN",
          balanceSnapshotMinor: null,
          balanceSnapshotAt: null,
          archivedAt: null,
          ownerPersonIds: [validPerson],
        },
      ];
      vi.mocked(listHouseholdAccountsSummary).mockResolvedValueOnce(mockAccounts as any);

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts`);
      const res = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([
        {
          id: "acc-1",
          householdId: validHousehold,
          name: "Main checking",
          type: "checking",
          currency: "PLN",
          balanceSnapshotMinor: null,
          balanceSnapshotAt: null,
          archivedAt: null,
          ownerPersonIds: [validPerson],
        },
      ]);
      expect(listHouseholdAccountsSummary).toHaveBeenCalledWith(testAccess);
    });
  });

  describe("POST", () => {
    it("creates an account and returns 201 with serialized response", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
      vi.mocked(createHouseholdAccountEntry).mockResolvedValueOnce({
        id: "acc-1",
        householdId: validHousehold,
        name: "Joint checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 10000n,
        balanceSnapshotAt: new Date("2026-09-07T12:00:00Z"),
        archivedAt: null,
        ownerPersonIds: [validPerson],
      } as any);

      const payload = {
        name: "Joint checking",
        type: "checking",
        currency: "PLN",
        ownerPersonIds: [validPerson],
        initialBalance: {
          amountNatural: "100.00",
        },
      };

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBe("acc-1");
      expect(body.data.balanceSnapshotMinor).toBe("10000");
    });

    it("rejects when owner is not in the same household with 400", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
      vi.mocked(createHouseholdAccountEntry).mockRejectedValueOnce(
        new AccountInvalidOwnerError(),
      );

      const payload = {
        name: "Invalid Owner Checking",
        type: "checking",
        currency: "PLN",
        ownerPersonIds: ["018f47a0-7762-7b9c-8d17-27f2f79e5999"],
      };

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req, {
        params: Promise.resolve({ householdId: validHousehold }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("All account owners must belong to this household");
    });
  });
});
