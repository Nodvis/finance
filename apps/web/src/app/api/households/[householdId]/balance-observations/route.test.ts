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
  listHouseholdBalanceHistory: vi.fn(),
  recordHouseholdBalanceObservation: vi.fn(),
}));

import { AccountNotFoundError } from "@nodvis/finance-db";
import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  listHouseholdBalanceHistory,
  recordHouseholdBalanceObservation,
} from "@/lib/net-worth/service";
import { GET, POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validAccountId = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold as any,
  personId: "person-1" as any,
};

describe("/api/households/[householdId]/balance-observations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new AuthenticationRequiredError(),
    );

    const res = await GET(
      new Request(`http://localhost/api/households/${validHousehold}/balance-observations`),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(401);
  });

  it("lists observations serialized with string amounts", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess);
    vi.mocked(listHouseholdBalanceHistory).mockResolvedValueOnce([
      {
        id: "obs-1",
        householdId: validHousehold,
        accountId: validAccountId,
        liabilityId: null,
        subjectName: "Main Account",
        subjectKind: "account",
        accountType: "checking",
        amountMinor: 250_000n,
        currency: "PLN",
        observedAt: new Date("2026-09-01T12:00:00Z"),
        source: "manual",
        note: "End of month",
        createdAt: new Date("2026-09-01T12:00:00Z"),
      },
    ]);

    const res = await GET(
      new Request(`http://localhost/api/households/${validHousehold}/balance-observations`),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].amountMinor).toBe("250000");
    expect(json.data[0].subjectName).toBe("Main Account");
  });

  it("records an observation and returns 201 with serialized result", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess);
    vi.mocked(recordHouseholdBalanceObservation).mockResolvedValueOnce({
      id: "obs-new",
      householdId: validHousehold,
      accountId: validAccountId,
      liabilityId: null,
      subjectName: "Main Account",
      subjectKind: "account",
      accountType: "checking",
      amountMinor: 300_000n,
      currency: "PLN",
      observedAt: new Date("2026-09-12T10:00:00Z"),
      source: "manual",
      note: "Updated balance",
      createdAt: new Date("2026-09-12T10:00:00Z"),
    });

    const res = await POST(
      new Request(`http://localhost/api/households/${validHousehold}/balance-observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "account",
          subjectId: validAccountId,
          amountNatural: "3000.00",
          observedAt: "2026-09-12T10:00:00Z",
          note: "Updated balance",
        }),
      }),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe("obs-new");
    expect(json.data.amountMinor).toBe("300000");
  });

  it("returns 404 when target account is not found in household", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(testAccess);
    vi.mocked(recordHouseholdBalanceObservation).mockRejectedValueOnce(
      new AccountNotFoundError("Account not found in household"),
    );

    const res = await POST(
      new Request(`http://localhost/api/households/${validHousehold}/balance-observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "account",
          subjectId: validAccountId,
          amountNatural: "100.00",
          observedAt: "2026-09-12T10:00:00Z",
        }),
      }),
      { params: Promise.resolve({ householdId: validHousehold }) },
    );

    expect(res.status).toBe(404);
  });
});
