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

vi.mock("@/lib/transfers/service", () => ({
  matchTransferEntry: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { matchTransferEntry } from "@/lib/transfers/service";
import { POST } from "./route";

const hId = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const tx1 = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const tx2 = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const testAccess = { authUserId: "u1", householdId: hId, personId: "p1" };

describe("/api/households/[householdId]/transfers/match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST matches transfer and returns 200 with result", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
    vi.mocked(matchTransferEntry).mockResolvedValue({
      transfer: {
        id: tx1,
        amount: { amountMinor: 10000n, currency: "PLN" },
      },
      match: {
        id: "m1",
        matchedTransactionId: tx2,
        matchConfidence: "automatic",
      },
    } as any);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        outflowTransactionId: tx1,
        expectedOutflowVersion: 1,
        inflowTransactionId: tx2,
        expectedInflowVersion: 1,
        matchedIdentifier: "PL74109024020000000123456789",
        matchConfidence: "automatic",
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ householdId: hId }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.transferId).toBe(tx1);
    expect(json.data.matchedTransactionId).toBe(tx2);
    expect(json.data.amountMinor).toBe("10000");
  });

  it("POST returns 400 on invalid input payload", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        outflowTransactionId: "not-a-uuid",
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ householdId: hId }),
    });

    expect(res.status).toBe(400);
  });
});
