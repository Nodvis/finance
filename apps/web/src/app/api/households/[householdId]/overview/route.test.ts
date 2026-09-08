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

vi.mock("@/lib/overview/service", () => ({
  getHouseholdOverview: vi.fn(),
}));

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import { getHouseholdOverview } from "@/lib/overview/service";
import { GET } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold as any,
  personId: "person-1" as any,
};

describe("/api/households/[householdId]/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when authentication is missing", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const res = await GET(
      new Request(`http://localhost/api/households/${validHousehold}/overview`),
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
      new Request(`http://localhost/api/households/${validHousehold}/overview`),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Household access denied");
  });

  it("returns 400 when query parameter has invalid month format", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess);

    const res = await GET(
      new Request(
        `http://localhost/api/households/${validHousehold}/overview?month=invalid-month`,
      ),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation error");
  });

  it("returns 200 with serialized overview and string amounts for large bigints", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess);

    vi.mocked(getHouseholdOverview).mockResolvedValueOnce({
      householdId: validHousehold,
      period: {
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T23:59:59.999Z"),
        monthKey: "2026-09",
        prevMonthKey: "2026-08",
        nextMonthKey: "2026-10",
      },
      availableCash: {
        byCurrency: [
          {
            currency: "PLN" as any,
            amountMinor: 10_000_000_000_000_000n, // Large bigint
            freshAccountCount: 2,
            missingAccountCount: 0,
            staleAccountCount: 0,
            isComplete: true,
          },
        ],
        missingAccounts: [],
        staleAccounts: [],
        totalEligibleAccounts: 2,
        freshAccountsCount: 2,
        isFullyKnown: true,
      },
      cashFlow: {
        byCurrency: [
          {
            currency: "PLN" as any,
            incomeMinor: 5_000_000_000_000_000n,
            spendingMinor: 2_000_000_000_000_000n,
            netCashFlowMinor: 3_000_000_000_000_000n,
            transactionCount: 8,
          },
        ],
        totalTransactionsCount: 8,
      },
      categorySpending: [
        {
          categoryId: "cat-1" as any,
          categoryName: "Food",
          currency: "PLN",
          amountMinor: 2_000_000_000_000_000n,
          transactionCount: 8,
          percentage: 100,
        },
      ],
    });

    const res = await GET(
      new Request(
        `http://localhost/api/households/${validHousehold}/overview?month=2026-09`,
      ),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.householdId).toBe(validHousehold);
    expect(json.data.period.monthKey).toBe("2026-09");
    expect(json.data.availableCash.byCurrency[0].amountMinor).toBe(
      "10000000000000000",
    );
    expect(json.data.cashFlow.byCurrency[0].netCashFlowMinor).toBe(
      "3000000000000000",
    );
  });
});
