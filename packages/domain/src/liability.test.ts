import { describe, expect, it } from "vitest";
import {
  accountId,
  householdId,
  liabilityId,
  liabilityRepaymentId,
  personId,
  transactionId,
} from "./identity";
import { money } from "./money";
import {
  archiveLiability,
  createLiability,
  createLiabilityRepayment,
  determineRepaymentAllocationState,
  isLiabilityArchived,
  isLiabilityRepaymentVoided,
  unarchiveLiability,
  updateLiability,
  validateObservedOutstandingSnapshot,
  voidLiabilityRepayment,
} from "./liability";

describe("Liability domain model", () => {
  const hId = householdId("11111111-1111-4111-8111-111111111111");
  const lId = liabilityId("11111111-1111-4111-8111-111111111112");
  const pId = personId("11111111-1111-4111-8111-111111111113");
  const destAccId = accountId("11111111-1111-4111-8111-111111111114");
  const txId = transactionId("11111111-1111-4111-8111-111111111115");
  const repId = liabilityRepaymentId("11111111-1111-4111-8111-111111111116");

  describe("createLiability", () => {
    it("creates a liability with explicit unknown balance observation", () => {
      const liability = createLiability({
        id: lId,
        householdId: hId,
        name: "Kredyt gotówkowy",
        currency: "PLN",
      });

      expect(liability.id).toBe(lId);
      expect(liability.householdId).toBe(hId);
      expect(liability.name).toBe("Kredyt gotówkowy");
      expect(liability.kind).toBe("loan");
      expect(liability.currency).toBe("PLN");
      expect(liability.observedOutstanding).toBeNull();
      expect(liability.observedOutstandingAt).toBeNull();
      expect(liability.version).toBe(1);
      expect(liability.archivedAt).toBeNull();
      expect(isLiabilityArchived(liability)).toBe(false);
    });

    it("creates a liability with known balance snapshot, destination account, and lender", () => {
      const snapshotDate = new Date("2026-09-01T12:00:00Z");
      const liability = createLiability({
        id: lId,
        householdId: hId,
        name: "Kredyt hipoteczny PKO",
        kind: "mortgage",
        currency: "PLN",
        observedOutstanding: money(350_000_00n, "PLN"),
        observedOutstandingAt: snapshotDate,
        responsiblePersonId: pId,
        lender: "PKO Bank Polski",
        destinationAccountId: destAccId,
        notes: "Stałe oprocentowanie 5 lat",
      });

      expect(liability.kind).toBe("mortgage");
      expect(liability.observedOutstanding?.amountMinor).toBe(350_000_00n);
      expect(liability.observedOutstandingAt).toEqual(snapshotDate);
      expect(liability.responsiblePersonId).toBe(pId);
      expect(liability.lender).toBe("PKO Bank Polski");
      expect(liability.destinationAccountId).toBe(destAccId);
      expect(liability.notes).toBe("Stałe oprocentowanie 5 lat");
    });

    it("supports exact money beyond Number.MAX_SAFE_INTEGER for outstanding balance", () => {
      const massiveAmount = 15_000_000_000_000_000n; // 150 trillion minor units > 9_007_199_254_740_991n
      const snapshotDate = new Date("2026-09-01T12:00:00Z");
      const liability = createLiability({
        id: lId,
        householdId: hId,
        name: "National Sovereign Debt",
        kind: "other",
        currency: "PLN",
        observedOutstanding: money(massiveAmount, "PLN"),
        observedOutstandingAt: snapshotDate,
      });

      expect(liability.observedOutstanding?.amountMinor).toBe(massiveAmount);
      expect(liability.observedOutstanding?.amountMinor).toBeGreaterThan(
        BigInt(Number.MAX_SAFE_INTEGER),
      );
    });

    it("rejects blank name", () => {
      expect(() =>
        createLiability({
          id: lId,
          householdId: hId,
          name: "   ",
          currency: "PLN",
        }),
      ).toThrow("Liability name cannot be blank");
    });

    it("rejects incomplete snapshot observation (amount provided without date)", () => {
      expect(() =>
        createLiability({
          id: lId,
          householdId: hId,
          name: "Test Loan",
          currency: "PLN",
          observedOutstanding: money(5000_00n, "PLN"),
        }),
      ).toThrow(
        "Observed outstanding amount and observation date must both be provided or both be null",
      );
    });

    it("rejects incomplete snapshot observation (date provided without amount)", () => {
      expect(() =>
        createLiability({
          id: lId,
          householdId: hId,
          name: "Test Loan",
          currency: "PLN",
          observedOutstandingAt: new Date(),
        }),
      ).toThrow(
        "Observed outstanding amount and observation date must both be provided or both be null",
      );
    });

    it("rejects negative observed outstanding amount", () => {
      expect(() =>
        createLiability({
          id: lId,
          householdId: hId,
          name: "Test Loan",
          currency: "PLN",
          observedOutstanding: money(-100n, "PLN"),
          observedOutstandingAt: new Date(),
        }),
      ).toThrow("Observed outstanding amount cannot be negative");
    });

    it("rejects currency mismatch between liability and observed snapshot", () => {
      expect(() =>
        createLiability({
          id: lId,
          householdId: hId,
          name: "Test Loan",
          currency: "PLN",
          observedOutstanding: money(1000_00n, "EUR"),
          observedOutstandingAt: new Date(),
        }),
      ).toThrow("Observed outstanding currency (EUR) does not match liability currency (PLN)");
    });
  });

  describe("updateLiability and archiving", () => {
    it("updates metadata, increments version, and preserves immutability", () => {
      const initial = createLiability({
        id: lId,
        householdId: hId,
        name: "Initial Name",
        currency: "PLN",
      });

      const updated = updateLiability(initial, {
        name: "Updated Name",
        lender: "New Lender",
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.lender).toBe("New Lender");
      expect(updated.version).toBe(2);
      expect(initial.version).toBe(1);
      expect(initial.name).toBe("Initial Name");
    });

    it("archives and restores liability correctly", () => {
      const initial = createLiability({
        id: lId,
        householdId: hId,
        name: "Loan to archive",
        currency: "PLN",
      });

      const archived = archiveLiability(initial);
      expect(isLiabilityArchived(archived)).toBe(true);
      expect(archived.version).toBe(2);

      const unarchived = unarchiveLiability(archived);
      expect(isLiabilityArchived(unarchived)).toBe(false);
      expect(unarchived.version).toBe(3);
    });
  });

  describe("LiabilityRepayment and allocation states", () => {
    it("creates repayment with completely unknown allocation", () => {
      const paidAt = new Date("2026-09-05T10:00:00Z");
      const repayment = createLiabilityRepayment({
        id: repId,
        householdId: hId,
        liabilityId: lId,
        transactionId: txId,
        paidAt,
        amount: money(1500_00n, "PLN"),
        // principal, interest, fee are omitted -> unknown
      });

      expect(repayment.allocationState).toBe("unknown");
      expect(repayment.principalAmount).toBeNull();
      expect(repayment.interestAmount).toBeNull();
      expect(repayment.feeAmount).toBeNull();
      expect(repayment.amount.amountMinor).toBe(1500_00n);
      expect(isLiabilityRepaymentVoided(repayment)).toBe(false);
    });

    it("creates repayment with partial allocation without inventing or forcing missing parts", () => {
      const paidAt = new Date("2026-09-05T10:00:00Z");
      const repayment = createLiabilityRepayment({
        id: repId,
        householdId: hId,
        liabilityId: lId,
        paidAt,
        amount: money(1500_00n, "PLN"),
        principalAmount: money(1200_00n, "PLN"),
        // interest and fee unknown
      });

      expect(repayment.allocationState).toBe("partial");
      expect(repayment.principalAmount?.amountMinor).toBe(1200_00n);
      expect(repayment.interestAmount).toBeNull();
      expect(repayment.feeAmount).toBeNull();
    });

    it("creates repayment with full allocation when all three are supplied and sum matches", () => {
      const paidAt = new Date("2026-09-05T10:00:00Z");
      const repayment = createLiabilityRepayment({
        id: repId,
        householdId: hId,
        liabilityId: lId,
        paidAt,
        amount: money(623_00n, "PLN"),
        principalAmount: money(500_00n, "PLN"),
        interestAmount: money(120_00n, "PLN"),
        feeAmount: money(3_00n, "PLN"),
      });

      expect(repayment.allocationState).toBe("full");
      expect(repayment.principalAmount?.amountMinor).toBe(500_00n);
      expect(repayment.interestAmount?.amountMinor).toBe(120_00n);
      expect(repayment.feeAmount?.amountMinor).toBe(3_00n);
    });

    it("supports exact money beyond Number.MAX_SAFE_INTEGER for repayment amount", () => {
      const massiveTotal = 12_000_000_000_000_000n;
      const massivePrincipal = 10_000_000_000_000_000n;
      const repayment = createLiabilityRepayment({
        id: repId,
        householdId: hId,
        liabilityId: lId,
        paidAt: new Date(),
        amount: money(massiveTotal, "PLN"),
        principalAmount: money(massivePrincipal, "PLN"),
      });

      expect(repayment.amount.amountMinor).toBe(massiveTotal);
      expect(repayment.principalAmount?.amountMinor).toBe(massivePrincipal);
      expect(repayment.allocationState).toBe("partial");
    });

    it("rejects repayment when sum of allocated components exceeds total amount", () => {
      expect(() =>
        createLiabilityRepayment({
          id: repId,
          householdId: hId,
          liabilityId: lId,
          paidAt: new Date(),
          amount: money(100_00n, "PLN"),
          principalAmount: money(80_00n, "PLN"),
          interestAmount: money(30_00n, "PLN"), // 80 + 30 = 110 > 100
        }),
      ).toThrow("exceeds total repayment amount");
    });

    it("rejects repayment when all three components are supplied but do not sum to total", () => {
      expect(() =>
        createLiabilityRepayment({
          id: repId,
          householdId: hId,
          liabilityId: lId,
          paidAt: new Date(),
          amount: money(100_00n, "PLN"),
          principalAmount: money(70_00n, "PLN"),
          interestAmount: money(20_00n, "PLN"),
          feeAmount: money(5_00n, "PLN"), // 70 + 20 + 5 = 95 != 100
        }),
      ).toThrow("must sum exactly to total repayment amount");
    });

    it("rejects currency mismatch on allocated components", () => {
      expect(() =>
        createLiabilityRepayment({
          id: repId,
          householdId: hId,
          liabilityId: lId,
          paidAt: new Date(),
          amount: money(100_00n, "PLN"),
          principalAmount: money(80_00n, "EUR"),
        }),
      ).toThrow("Principal amount currency must match total repayment currency");
    });

    it("rejects non-positive total repayment amount", () => {
      expect(() =>
        createLiabilityRepayment({
          id: repId,
          householdId: hId,
          liabilityId: lId,
          paidAt: new Date(),
          amount: money(0n, "PLN"),
        }),
      ).toThrow("Repayment amount must be strictly positive");
    });

    it("voids a repayment with reason and increments version", () => {
      const repayment = createLiabilityRepayment({
        id: repId,
        householdId: hId,
        liabilityId: lId,
        paidAt: new Date(),
        amount: money(100_00n, "PLN"),
      });

      const voided = voidLiabilityRepayment(repayment, "Wrong loan selected");
      expect(isLiabilityRepaymentVoided(voided)).toBe(true);
      expect(voided.voidReason).toBe("Wrong loan selected");
      expect(voided.version).toBe(2);

      expect(() => voidLiabilityRepayment(voided)).toThrow(
        "Repayment is already voided",
      );
    });
  });
});
