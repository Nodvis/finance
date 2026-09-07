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
  AccountNotFoundError: class AccountNotFoundError extends Error {
    constructor(message: string = "Account not found in household") {
      super(message);
      this.name = "AccountNotFoundError";
    }
  },
  archiveAccount: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { AccountNotFoundError, archiveAccount } from "@/lib/accounts/service";
import { POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validAccount = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
};

describe("POST /api/households/[householdId]/accounts/[accountId]/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives account without deleting history and returns 200", async () => {
    const archiveDate = new Date("2026-09-07T12:00:00Z");
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
    vi.mocked(archiveAccount).mockResolvedValueOnce({
      id: validAccount,
      householdId: validHousehold,
      name: "Old Savings",
      type: "savings",
      currency: "PLN",
      balanceSnapshotMinor: 1000n,
      balanceSnapshotAt: archiveDate,
      archivedAt: archiveDate,
      ownerPersonIds: [validPerson],
    } as any);

    const req = new Request(`http://localhost/api/households/${validHousehold}/accounts/${validAccount}/archive`, {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.archivedAt).toBe(archiveDate.toISOString());
    expect(archiveAccount).toHaveBeenCalledWith(testAccess, validAccount);
  });

  it("returns 404 when account does not exist in household", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess as any);
    vi.mocked(archiveAccount).mockRejectedValueOnce(new AccountNotFoundError());

    const req = new Request(`http://localhost/api/households/${validHousehold}/accounts/${validAccount}/archive`, {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }),
    });

    expect(res.status).toBe(404);
  });
});
