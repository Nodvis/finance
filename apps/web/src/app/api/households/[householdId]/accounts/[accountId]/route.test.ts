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
  AccountNotFoundError: class AccountNotFoundError extends Error {
    constructor(message: string = "Account not found in household") {
      super(message);
      this.name = "AccountNotFoundError";
    }
  },
  getHouseholdAccount: vi.fn(),
  updateHouseholdAccountMetadataEntry: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  AccountInvalidOwnerError,
  AccountNotFoundError,
  getHouseholdAccount,
  updateHouseholdAccountMetadataEntry,
} from "@/lib/accounts/service";
import { GET, PATCH } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validAccount = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
};

describe("/api/households/[householdId]/accounts/[accountId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 200 with serialized account", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
      vi.mocked(getHouseholdAccount).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "My Checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 5000n,
        balanceSnapshotAt: new Date("2026-09-07T12:00:00Z"),
        archivedAt: null,
        ownerPersonIds: [validPerson],
      } as any);

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts/${validAccount}`);
      const res = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(validAccount);
      expect(body.data.balanceSnapshotMinor).toBe("5000");
    });

    it("returns 404 when account not found", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
      vi.mocked(getHouseholdAccount).mockRejectedValueOnce(new AccountNotFoundError());

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts/${validAccount}`);
      const res = await GET(req, {
        params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH", () => {
    it("updates account metadata and returns 200", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
      vi.mocked(updateHouseholdAccountMetadataEntry).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        name: "Renamed",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: null,
        balanceSnapshotAt: null,
        archivedAt: null,
        ownerPersonIds: [validPerson],
      } as any);

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts/${validAccount}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.name).toBe("Renamed");
    });

    it("returns 400 when owner does not belong to household", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
      vi.mocked(updateHouseholdAccountMetadataEntry).mockRejectedValueOnce(
        new AccountInvalidOwnerError(),
      );

      const req = new Request(`http://localhost/api/households/${validHousehold}/accounts/${validAccount}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerPersonIds: ["018f47a0-7762-7b9c-8d17-27f2f79e5999"] }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }),
      });

      expect(res.status).toBe(400);
    });
  });
});
