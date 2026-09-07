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
  requireCurrentUserHouseholdContext: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireCurrentUserHouseholdContext,
} from "@/lib/authorization/household";
import { GET } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validPerson = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";

describe("GET /api/households/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireCurrentUserHouseholdContext).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication is required");
  });

  it("returns 404 when no household associated with user", async () => {
    vi.mocked(requireCurrentUserHouseholdContext).mockRejectedValueOnce(
      new HouseholdAccessDeniedError(),
    );

    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("No household associated with user");
  });

  it("returns 200 with current household context when authorized", async () => {
    const mockContext = {
      authUserId: "user-1",
      householdId: validHousehold,
      householdName: "Our Family",
      personId: validPerson,
      personDisplayName: "Jan",
      defaultCurrency: "PLN",
    };
    vi.mocked(requireCurrentUserHouseholdContext).mockResolvedValueOnce(mockContext as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(mockContext);
  });
});
