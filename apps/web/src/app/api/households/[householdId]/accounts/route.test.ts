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

vi.mock("@/lib/transactions/service", () => ({
  listHouseholdAccounts: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { listHouseholdAccounts } from "@/lib/transactions/service";
import { GET } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
};

describe("GET /api/households/[householdId]/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      },
    ];
    vi.mocked(listHouseholdAccounts).mockResolvedValueOnce(mockAccounts as any);

    const req = new Request(`http://localhost/api/households/${validHousehold}/accounts`);
    const res = await GET(req, {
      params: Promise.resolve({ householdId: validHousehold }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(mockAccounts);
    expect(listHouseholdAccounts).toHaveBeenCalledWith(testAccess);
  });
});
