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

vi.mock("@/lib/net-worth/service", () => ({
  getHouseholdNetWorthSummary: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { getHouseholdNetWorthSummary } from "@/lib/net-worth/service";
import { GET } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold as any,
  personId: "person-1" as any,
};

describe("/api/households/[householdId]/net-worth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when authentication is missing", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const res = await GET(
      new Request(`http://localhost/api/households/${validHousehold}/net-worth`),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Authentication is required");
  });

  it("returns 403 when user does not have access to household", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new HouseholdAccessDeniedError(),
    );

    const res = await GET(
      new Request(`http://localhost/api/households/${validHousehold}/net-worth`),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Household access denied");
  });

  it("returns 200 with serialized net worth summary preserving exact bigints as strings", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess);

    vi.mocked(getHouseholdNetWorthSummary).mockResolvedValueOnce({
      byCurrency: [
        {
          currency: "PLN" as any,
          points: [
            {
              date: "2026-09-01",
              timestamp: new Date("2026-09-01T23:59:59.999Z"),
              currency: "PLN" as any,
              assetsMinor: 10_000_000_000n,
              liabilitiesMinor: 2_000_000_000n,
              netWorthMinor: 8_000_000_000n,
              confidence: "complete",
              isComplete: true,
              observedSubjectCount: 3,
              totalSubjectCount: 3,
              missingSubjectNames: [],
            },
          ],
          currentNetWorthMinor: 8_000_000_000n,
          currentAssetsMinor: 10_000_000_000n,
          currentLiabilitiesMinor: 2_000_000_000n,
          currentConfidence: "complete",
          currentIsComplete: true,
          missingSubjectNames: [],
          latestObservedAt: new Date("2026-09-01T12:00:00Z"),
        },
      ],
    });

    const res = await GET(
      new Request(`http://localhost/api/households/${validHousehold}/net-worth`),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.byCurrency).toHaveLength(1);
    const pln = json.data.byCurrency[0];
    expect(pln.currency).toBe("PLN");
    expect(pln.currentNetWorthMinor).toBe("8000000000");
    expect(pln.currentAssetsMinor).toBe("10000000000");
    expect(pln.currentLiabilitiesMinor).toBe("2000000000");
    expect(pln.currentConfidence).toBe("complete");
    expect(pln.currentIsComplete).toBe(true);
    expect(pln.points[0].netWorthMinor).toBe("8000000000");
  });
});
