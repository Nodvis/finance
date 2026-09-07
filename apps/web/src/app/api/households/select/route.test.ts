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
  ACTIVE_HOUSEHOLD_COOKIE_NAME: "nodvis_active_household",
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {
    constructor() {
      super("Household access denied");
      this.name = "HouseholdAccessDeniedError";
    }
  },
  requireHouseholdAccess: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { POST } from "./route";

const validHouseholdId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";

describe("POST /api/households/select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const req = new Request("http://localhost/api/households/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId: validHouseholdId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user does not have access to household", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new HouseholdAccessDeniedError(),
    );

    const req = new Request("http://localhost/api/households/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId: validHouseholdId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 and sets cookie when authorized", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
      authUserId: "user-1",
      householdId: validHouseholdId as any,
      personId: "person-1" as any,
    });

    const req = new Request("http://localhost/api/households/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId: validHouseholdId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.activeHouseholdId).toBe(validHouseholdId);
    expect(res.cookies.get("nodvis_active_household")?.value).toBe(validHouseholdId);
  });
});
