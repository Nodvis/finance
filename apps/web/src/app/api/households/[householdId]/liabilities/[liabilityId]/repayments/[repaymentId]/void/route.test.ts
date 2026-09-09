import { beforeEach, describe, expect, it, vi } from "vitest";
import { currencyCode } from "@nodvis/finance-domain";

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
  LiabilityRepaymentNotFoundError: class LiabilityRepaymentNotFoundError extends Error {},
  LiabilityRepaymentVersionConflictError: class LiabilityRepaymentVersionConflictError extends Error {},
  LiabilityRepaymentAlreadyVoidedError: class LiabilityRepaymentAlreadyVoidedError extends Error {},
  voidHouseholdLiabilityRepayment: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import { voidHouseholdLiabilityRepayment } from "@/lib/liabilities/service";
import { POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validLiability = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validRepayment = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/liabilities/[liabilityId]/repayments/[repaymentId]/void", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("voids repayment and returns 200 with serialized voided repayment", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
      testAccess as any,
    );
    vi.mocked(voidHouseholdLiabilityRepayment).mockResolvedValueOnce({
      id: validRepayment as any,
      householdId: validHousehold as any,
      liabilityId: validLiability as any,
      transactionId: "tx-1" as any,
      paidAt: new Date("2026-09-01T00:00:00Z"),
      amount: { amountMinor: 20000n, currency: currencyCode("PLN") },
      principalAmount: null,
      interestAmount: null,
      feeAmount: null,
      allocationState: "unknown",
      notes: null,
      version: 2,
      voidedAt: new Date("2026-09-08T00:00:00Z"),
      voidReason: "Accidental duplicate",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-08T00:00:00Z"),
    });

    const res = await POST(
      new Request(
        `http://localhost/api/households/${validHousehold}/liabilities/${validLiability}/repayments/${validRepayment}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: 1,
            voidReason: "Accidental duplicate",
          }),
        },
      ),
      {
        params: Promise.resolve({
          householdId: validHousehold,
          liabilityId: validLiability,
          repaymentId: validRepayment,
        }),
      },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.voidedAt).not.toBeNull();
    expect(json.data.voidReason).toBe("Accidental duplicate");
    expect(json.data.version).toBe(2);
  });
});
