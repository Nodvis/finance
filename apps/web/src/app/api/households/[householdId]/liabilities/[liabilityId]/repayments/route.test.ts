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
  LiabilityNotFoundError: class LiabilityNotFoundError extends Error {},
  LiabilityVersionConflictError: class LiabilityVersionConflictError extends Error {},
  LiabilityDestinationAccountNotFoundError: class LiabilityDestinationAccountNotFoundError extends Error {},
  LiabilityDestinationAccountCurrencyMismatchError: class LiabilityDestinationAccountCurrencyMismatchError extends Error {},
  LiabilityDestinationAccountInvalidHouseholdError: class LiabilityDestinationAccountInvalidHouseholdError extends Error {},
  LiabilityRepaymentNotFoundError: class LiabilityRepaymentNotFoundError extends Error {},
  LiabilityRepaymentAlreadyVoidedError: class LiabilityRepaymentAlreadyVoidedError extends Error {},
  LiabilityRepaymentVersionConflictError: class LiabilityRepaymentVersionConflictError extends Error {},
  LiabilityRepaymentSourceAccountNotFoundError: class LiabilityRepaymentSourceAccountNotFoundError extends Error {},
  LiabilityRepaymentSourceAccountCurrencyMismatchError: class LiabilityRepaymentSourceAccountCurrencyMismatchError extends Error {},
  LiabilityInvalidResponsiblePersonError: class LiabilityInvalidResponsiblePersonError extends Error {},
  LiabilityRepaymentInvalidAllocationError: class LiabilityRepaymentInvalidAllocationError extends Error {},
  listHouseholdLiabilityRepayments: vi.fn(),
  recordHouseholdLiabilityRepayment: vi.fn(),
}));

import { requireHouseholdAccess } from "@/lib/authorization/household";
import {
  listHouseholdLiabilityRepayments,
  recordHouseholdLiabilityRepayment,
} from "@/lib/liabilities/service";
import { GET, POST } from "./route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validLiability = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validRepayment = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

describe("/api/households/[householdId]/liabilities/[liabilityId]/repayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 200 with repayments list", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(listHouseholdLiabilityRepayments).mockResolvedValueOnce([
        {
          id: validRepayment as any,
          householdId: validHousehold as any,
          liabilityId: validLiability as any,
          transactionId: null,
          paidAt: new Date("2026-09-01T10:00:00Z"),
          amount: { amountMinor: 50000n, currency: currencyCode("PLN") },
          principalAmount: { amountMinor: 40000n, currency: currencyCode("PLN") },
          interestAmount: { amountMinor: 10000n, currency: currencyCode("PLN") },
          feeAmount: null,
          allocationState: "partial",
          notes: null,
          version: 1,
          voidedAt: null,
          voidReason: null,
          createdAt: new Date("2026-09-01T10:00:00Z"),
          updatedAt: new Date("2026-09-01T10:00:00Z"),
        },
      ]);

      const res = await GET(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities/${validLiability}/repayments`),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            liabilityId: validLiability,
          }),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].amountMinor).toBe("50000");
      expect(json.data[0].allocationState).toBe("partial");
    });
  });

  describe("POST", () => {
    it("records repayment and returns 201 with repayment and linked transaction", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValueOnce(
        testAccess as any,
      );
      vi.mocked(recordHouseholdLiabilityRepayment).mockResolvedValueOnce({
        repayment: {
          id: validRepayment as any,
          householdId: validHousehold as any,
          liabilityId: validLiability as any,
          transactionId: "tx-1" as any,
          paidAt: new Date("2026-09-05T10:00:00Z"),
          amount: { amountMinor: 62300n, currency: currencyCode("PLN") },
          principalAmount: { amountMinor: 50000n, currency: currencyCode("PLN") },
          interestAmount: { amountMinor: 12300n, currency: currencyCode("PLN") },
          feeAmount: { amountMinor: 0n, currency: currencyCode("PLN") },
          allocationState: "full",
          notes: "Regular installment",
          version: 1,
          voidedAt: null,
          voidReason: null,
          createdAt: new Date("2026-09-05T10:00:00Z"),
          updatedAt: new Date("2026-09-05T10:00:00Z"),
        },
        transaction: {
          id: "tx-1" as any,
          householdId: validHousehold as any,
          kind: "expense",
          accountId: "acc-1" as any,
          amount: { amountMinor: 62300n, currency: currencyCode("PLN") },
          payee: "Bank",
          paidByPersonId: "person-1" as any,
          occurredOn: new Date("2026-09-05T10:00:00Z"),
          categoryId: null,
          version: 1,
          voidedAt: null,
          voidReason: null,
        },
      });

      const res = await POST(
        new Request(`http://localhost/api/households/${validHousehold}/liabilities/${validLiability}/repayments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paidAt: "2026-09-05T10:00:00Z",
            amountNatural: "623.00",
            principalNatural: "500.00",
            interestNatural: "123.00",
            feeNatural: "0.00",
            notes: "Regular installment",
            sourceAccountId: "018f47a0-7762-7b9c-8d17-27f2f79e59a9",
          }),
        }),
        {
          params: Promise.resolve({
            householdId: validHousehold,
            liabilityId: validLiability,
          }),
        },
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.repayment.amountMinor).toBe("62300");
      expect(json.data.repayment.allocationState).toBe("full");
      expect(json.data.transaction).not.toBeNull();
      expect(json.data.transaction.id).toBe("tx-1");
    });
  });
});
