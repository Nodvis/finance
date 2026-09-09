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
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {},
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("@/lib/liabilities/service", () => ({
  LiabilityNotFoundError: class LiabilityNotFoundError extends Error {},
  LiabilityVersionConflictError: class LiabilityVersionConflictError extends Error {},
  archiveHouseholdLiabilityEntry: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  archiveHouseholdLiabilityEntry,
} from "@/lib/liabilities/service";
import { POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validLiability = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/liabilities/[liabilityId]/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives liability and returns 200", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
      testAccess as any,
    );
    vi.mocked(archiveHouseholdLiabilityEntry).mockResolvedValueOnce({
      id: validLiability,
      householdId: validHousehold,
      name: "Old Loan",
      kind: "loan",
      currency: "PLN",
      observedOutstandingMinor: null,
      observedOutstandingAt: null,
      responsiblePersonId: null,
      responsiblePersonName: null,
      lender: null,
      destinationAccountId: null,
      destinationAccountName: null,
      notes: null,
      version: 2,
      archivedAt: new Date("2026-09-08T00:00:00Z"),
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-08T00:00:00Z"),
    });

    const res = await POST(
      new Request(`http://localhost/api/households/${validHousehold}/liabilities/${validLiability}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      {
        params: Promise.resolve({
          householdId: validHousehold,
          liabilityId: validLiability,
        }),
      },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.archivedAt).not.toBeNull();
    expect(json.data.version).toBe(2);
  });
});
