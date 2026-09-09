import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@nodvis/finance-db", () => ({
  LiabilityNotFoundError: class LiabilityNotFoundError extends Error {
    constructor(message: string = "Liability not found in household") {
      super(message);
      this.name = "LiabilityNotFoundError";
    }
  },
  LiabilityVersionConflictError: class LiabilityVersionConflictError extends Error {
    constructor(message: string = "Liability was modified concurrently") {
      super(message);
      this.name = "LiabilityVersionConflictError";
    }
  },
  LiabilityDestinationAccountNotFoundError: class LiabilityDestinationAccountNotFoundError extends Error {
    constructor(message: string = "Repayment destination account not found") {
      super(message);
      this.name = "LiabilityDestinationAccountNotFoundError";
    }
  },
  LiabilityDestinationAccountCurrencyMismatchError: class LiabilityDestinationAccountCurrencyMismatchError extends Error {
    constructor(message: string = "Destination account currency mismatch") {
      super(message);
      this.name = "LiabilityDestinationAccountCurrencyMismatchError";
    }
  },
  LiabilityRepaymentNotFoundError: class LiabilityRepaymentNotFoundError extends Error {
    constructor(message: string = "Liability repayment not found") {
      super(message);
      this.name = "LiabilityRepaymentNotFoundError";
    }
  },
  LiabilityRepaymentAlreadyVoidedError: class LiabilityRepaymentAlreadyVoidedError extends Error {
    constructor(message: string = "Liability repayment already voided") {
      super(message);
      this.name = "LiabilityRepaymentAlreadyVoidedError";
    }
  },
  LiabilityRepaymentVersionConflictError: class LiabilityRepaymentVersionConflictError extends Error {
    constructor(message: string = "Liability repayment version conflict") {
      super(message);
      this.name = "LiabilityRepaymentVersionConflictError";
    }
  },
  findAccountInHousehold: vi.fn(),
  findLiabilityById: vi.fn(),
  findLiabilityRepaymentById: vi.fn(),
  insertLiabilityInDb: vi.fn(),
  isPersonInHousehold: vi.fn(),
  listLiabilitiesByHousehold: vi.fn(),
  listLiabilityRepaymentsByHousehold: vi.fn(),
  recordLiabilityRepaymentInDb: vi.fn(),
  archiveLiabilityInDb: vi.fn(),
  unarchiveLiabilityInDb: vi.fn(),
  updateLiabilityInDb: vi.fn(),
  voidLiabilityRepaymentInDb: vi.fn(),
}));

import {
  LiabilityDestinationAccountCurrencyMismatchError,
  LiabilityDestinationAccountNotFoundError,
  LiabilityNotFoundError,
  findAccountInHousehold,
  findLiabilityById,
  findLiabilityRepaymentById,
  insertLiabilityInDb,
  isPersonInHousehold,
  listLiabilitiesByHousehold,
  listLiabilityRepaymentsByHousehold,
  recordLiabilityRepaymentInDb,
  archiveLiabilityInDb,
  unarchiveLiabilityInDb,
  updateLiabilityInDb,
  voidLiabilityRepaymentInDb,
} from "@nodvis/finance-db";
import {
  LiabilityInvalidResponsiblePersonError,
  LiabilityRepaymentInvalidAllocationError,
  LiabilityRepaymentSourceAccountCurrencyMismatchError,
  LiabilityRepaymentSourceAccountNotFoundError,
  archiveHouseholdLiabilityEntry,
  createHouseholdLiabilityEntry,
  getHouseholdLiability,
  listHouseholdLiabilities,
  listHouseholdLiabilityRepayments,
  recordHouseholdLiabilityRepayment,
  unarchiveHouseholdLiabilityEntry,
  updateHouseholdLiabilityEntry,
  voidHouseholdLiabilityRepayment,
} from "./service";
import { householdId, personId } from "@nodvis/finance-domain";

const validHousehold = householdId("018f47a0-7762-7b9c-8d17-27f2f79e59a1");
const validPerson = personId("018f47a0-7762-7b9c-8d17-27f2f79e59a2");
const validLiability = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";
const validAccount = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";

const testContext = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: validPerson,
  householdName: "Our Home",
  personDisplayName: "Eryk",
  defaultCurrency: "PLN",
};

describe("Liabilities Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listHouseholdLiabilities", () => {
    it("returns liabilities list from db", async () => {
      const mockLiabilities = [
        {
          id: validLiability,
          householdId: validHousehold,
          name: "Mortgage",
          kind: "mortgage" as const,
          currency: "PLN",
          observedOutstandingMinor: 40000000n,
          observedOutstandingAt: new Date("2026-09-01"),
          responsiblePersonId: validPerson,
          responsiblePersonName: "Eryk",
          lender: "Bank XYZ",
          destinationAccountId: null,
          destinationAccountName: null,
          notes: "Monthly installment",
          version: 1,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(listLiabilitiesByHousehold).mockResolvedValueOnce(mockLiabilities);

      const result = await listHouseholdLiabilities(testContext, {
        includeArchived: true,
      });

      expect(result).toEqual(mockLiabilities);
      expect(listLiabilitiesByHousehold).toHaveBeenCalledWith(validHousehold, {
        includeArchived: true,
      });
    });
  });

  describe("getHouseholdLiability", () => {
    it("returns liability when found", async () => {
      const mockLiability = {
        id: validLiability,
        householdId: validHousehold,
        name: "Car Loan",
        kind: "loan" as const,
        currency: "PLN",
        observedOutstandingMinor: 2500000n,
        observedOutstandingAt: new Date(),
        responsiblePersonId: null,
        responsiblePersonName: null,
        lender: "AutoCredit",
        destinationAccountId: null,
        destinationAccountName: null,
        notes: null,
        version: 1,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(findLiabilityById).mockResolvedValueOnce(mockLiability);

      const result = await getHouseholdLiability(testContext, validLiability);
      expect(result).toEqual(mockLiability);
    });

    it("throws LiabilityNotFoundError when not found", async () => {
      vi.mocked(findLiabilityById).mockResolvedValueOnce(null);

      await expect(
        getHouseholdLiability(testContext, validLiability),
      ).rejects.toThrow(LiabilityNotFoundError);
    });
  });

  describe("createHouseholdLiabilityEntry", () => {
    it("creates liability with exact natural money parsing and unknown balance", async () => {
      const mockCreated = {
        id: validLiability,
        householdId: validHousehold,
        name: "BNPL Plan",
        kind: "installment" as const,
        currency: "PLN",
        observedOutstandingMinor: null,
        observedOutstandingAt: null,
        responsiblePersonId: null,
        responsiblePersonName: null,
        lender: "Allegro Pay",
        destinationAccountId: null,
        destinationAccountName: null,
        notes: null,
        version: 1,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(insertLiabilityInDb).mockResolvedValueOnce({} as any);
      vi.mocked(findLiabilityById).mockResolvedValueOnce(mockCreated);

      const result = await createHouseholdLiabilityEntry(testContext, {
        name: "BNPL Plan",
        kind: "installment",
        currency: "PLN",
        lender: "Allegro Pay",
      });

      expect(result).toEqual(mockCreated);
      expect(insertLiabilityInDb).toHaveBeenCalled();
    });

    it("validates responsible person belongs to household", async () => {
      vi.mocked(isPersonInHousehold).mockResolvedValueOnce(false);

      await expect(
        createHouseholdLiabilityEntry(testContext, {
          name: "Test Loan",
          currency: "PLN",
          responsiblePersonId: "018f47a0-7762-7b9c-8d17-27f2f79e5999",
        }),
      ).rejects.toThrow(LiabilityInvalidResponsiblePersonError);
    });

    it("validates repayment destination account currency matches liability", async () => {
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: validAccount,
        householdId: validHousehold,
        currency: "EUR", // mismatch with PLN
        name: "EUR Account",
      } as any);

      await expect(
        createHouseholdLiabilityEntry(testContext, {
          name: "Credit Card Debt",
          currency: "PLN",
          destinationAccountId: validAccount,
        }),
      ).rejects.toThrow(LiabilityDestinationAccountCurrencyMismatchError);
    });

    it("requires observation date when observed outstanding is provided", async () => {
      await expect(
        createHouseholdLiabilityEntry(testContext, {
          name: "Loan Without Date",
          currency: "PLN",
          observedOutstandingNatural: "1000.00",
          observedOutstandingAt: null,
        }),
      ).rejects.toThrow(/Observation date must be provided/);
    });
  });

  describe("recordHouseholdLiabilityRepayment", () => {
    it("preserves unknown principal/interest/fee state when allocation is omitted", async () => {
      const mockLiability = {
        id: validLiability,
        householdId: validHousehold,
        name: "Car Loan",
        kind: "loan" as const,
        currency: "PLN",
        observedOutstandingMinor: 2500000n,
        observedOutstandingAt: new Date(),
        responsiblePersonId: null,
        responsiblePersonName: null,
        lender: "AutoCredit",
        destinationAccountId: null,
        destinationAccountName: null,
        notes: null,
        version: 1,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(findLiabilityById).mockResolvedValueOnce(mockLiability);

      const mockRepaymentResult = {
        repayment: {
          id: "rep-1",
          householdId: validHousehold,
          liabilityId: validLiability,
          transactionId: null,
          paidAt: new Date("2026-09-05"),
          amount: { amountMinor: 50000n, currency: "PLN" },
          principalAmount: null,
          interestAmount: null,
          feeAmount: null,
          allocationState: "unknown" as const,
          notes: null,
          version: 1,
          voidedAt: null,
          voidReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        transaction: null,
      };
      vi.mocked(recordLiabilityRepaymentInDb).mockResolvedValueOnce(
        mockRepaymentResult as any,
      );

      const result = await recordHouseholdLiabilityRepayment(
        testContext,
        validLiability,
        {
          paidAt: new Date("2026-09-05"),
          amountNatural: "500,00",
        },
      );

      expect(result.repayment.allocationState).toBe("unknown");
      expect(result.repayment.principalAmount).toBeNull();
      expect(result.repayment.interestAmount).toBeNull();
      expect(result.repayment.feeAmount).toBeNull();
    });

    it("creates linked transfer transaction when sourceAccountId is given and liability has destination account", async () => {
      const mockLiability = {
        id: validLiability,
        householdId: validHousehold,
        name: "Credit Card",
        kind: "credit_line" as const,
        currency: "PLN",
        observedOutstandingMinor: 300000n,
        observedOutstandingAt: new Date(),
        responsiblePersonId: validPerson,
        responsiblePersonName: "Eryk",
        lender: "Visa Bank",
        destinationAccountId: validAccount,
        destinationAccountName: "Credit Card Account",
        notes: null,
        version: 1,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(findLiabilityById).mockResolvedValueOnce(mockLiability);
      vi.mocked(findAccountInHousehold).mockResolvedValueOnce({
        id: "source-acc",
        householdId: validHousehold,
        currency: "PLN",
        name: "Checking",
      } as any);

      vi.mocked(recordLiabilityRepaymentInDb).mockImplementationOnce(
        async (params) => {
          return {
            repayment: params.repayment,
            transaction: params.cashTransaction ?? null,
          };
        },
      );

      const result = await recordHouseholdLiabilityRepayment(
        testContext,
        validLiability,
        {
          paidAt: new Date("2026-09-05"),
          amountNatural: "200.00",
          sourceAccountId: "018f47a0-7762-7b9c-8d17-27f2f79e59a5",
        },
      );

      expect(result.transaction).not.toBeNull();
      expect(result.transaction?.kind).toBe("transfer");
    });

    it("rejects repayment when allocation components exceed total amount", async () => {
      const mockLiability = {
        id: validLiability,
        householdId: validHousehold,
        name: "Mortgage",
        kind: "mortgage" as const,
        currency: "PLN",
        observedOutstandingMinor: 50000000n,
        observedOutstandingAt: new Date(),
        responsiblePersonId: null,
        responsiblePersonName: null,
        lender: null,
        destinationAccountId: null,
        destinationAccountName: null,
        notes: null,
        version: 1,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(findLiabilityById).mockResolvedValueOnce(mockLiability);

      await expect(
        recordHouseholdLiabilityRepayment(testContext, validLiability, {
          paidAt: new Date(),
          amountNatural: "500.00",
          principalNatural: "400.00",
          interestNatural: "200.00", // 400 + 200 = 600 > 500
        }),
      ).rejects.toThrow(LiabilityRepaymentInvalidAllocationError);
    });
  });

  describe("voidHouseholdLiabilityRepayment", () => {
    it("voids repayment through db access with audit actor", async () => {
      vi.mocked(findLiabilityRepaymentById).mockResolvedValueOnce({
        id: "rep-1",
        householdId: validHousehold,
        liabilityId: validLiability,
      } as any);

      const mockVoided = {
        id: "rep-1",
        version: 2,
        voidedAt: new Date(),
        voidReason: "Mistake",
      };
      vi.mocked(voidLiabilityRepaymentInDb).mockResolvedValueOnce(
        mockVoided as any,
      );

      const result = await voidHouseholdLiabilityRepayment(
        testContext,
        validLiability,
        "rep-1",
        {
          expectedVersion: 1,
          voidReason: "Mistake",
        },
      );

      expect(result).toEqual(mockVoided);
      expect(voidLiabilityRepaymentInDb).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rep-1",
          expectedVersion: 1,
          voidReason: "Mistake",
          auditActor: expect.objectContaining({
            authUserId: "user-1",
            source: "manual",
          }),
        }),
      );
    });
  });
});
