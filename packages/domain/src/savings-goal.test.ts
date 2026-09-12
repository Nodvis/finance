import { describe, expect, it } from "vitest";
import { householdId, savingsGoalId, accountId } from "./identity";
import { money } from "./money";
import {
  archiveSavingsGoal,
  calculateSavingsGoalContribution,
  completeSavingsGoal,
  contributeToSavingsGoal,
  createSavingsGoal,
  unarchiveSavingsGoal,
  uncompleteSavingsGoal,
  updateSavingsGoal,
  validateCalendarDate,
  validateSavingsGoalName,
  validateSavingsGoalNotes,
} from "./savings-goal";

describe("SavingsGoal domain", () => {
  const hId = householdId("11111111-1111-4111-8111-111111111111");
  const aId = accountId("22222222-2222-4222-8222-222222222222");

  describe("Validation", () => {
    it("validates calendar date format and logical dates", () => {
      expect(validateCalendarDate("2026-12-31")).toBe("2026-12-31");
      expect(() => validateCalendarDate("invalid")).toThrow("Expected YYYY-MM-DD");
      expect(() => validateCalendarDate("2026-02-30")).toThrow("Invalid calendar date");
    });

    it("validates name not blank and length limits", () => {
      expect(validateSavingsGoalName("Emergency Fund")).toBe("Emergency Fund");
      expect(() => validateSavingsGoalName("   ")).toThrow("cannot be blank");
      expect(() => validateSavingsGoalName("x".repeat(161))).toThrow("exceeds maximum length");
    });

    it("validates notes length limits", () => {
      expect(validateSavingsGoalNotes(null)).toBeNull();
      expect(validateSavingsGoalNotes("   ")).toBeNull();
      expect(validateSavingsGoalNotes("Save 6 months of expenses")).toBe("Save 6 months of expenses");
      expect(() => validateSavingsGoalNotes("x".repeat(501))).toThrow("exceeds maximum length");
    });
  });

  describe("Lifecycle and Mutations", () => {
    it("creates a savings goal with defaults", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "New Car",
        targetAmount: money(5000000n, "PLN"),
      });

      expect(goal.name).toBe("New Car");
      expect(goal.targetAmount.amountMinor).toBe(5000000n);
      expect(goal.currentAmount.amountMinor).toBe(0n);
      expect(goal.status).toBe("active");
      expect(goal.targetDate).toBeNull();
      expect(goal.accountId).toBeNull();
      expect(goal.version).toBe(1);
    });

    it("creates an already completed savings goal if currentAmount >= targetAmount", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Holiday",
        targetAmount: money(200000n, "PLN"),
        currentAmount: money(200000n, "PLN"),
      });

      expect(goal.status).toBe("completed");
      expect(goal.completedAt).not.toBeNull();
    });

    it("rejects non-positive target amount or negative current amount", () => {
      expect(() =>
        createSavingsGoal({
          householdId: hId,
          name: "Invalid",
          targetAmount: money(0n, "PLN"),
        }),
      ).toThrow("strictly positive");

      expect(() =>
        createSavingsGoal({
          householdId: hId,
          name: "Invalid",
          targetAmount: money(1000n, "PLN"),
          currentAmount: money(-50n, "PLN"),
        }),
      ).toThrow("cannot be negative");
    });

    it("updates fields and increments version", () => {
      const initial = createSavingsGoal({
        householdId: hId,
        name: "Vacation",
        targetAmount: money(500000n, "PLN"),
      });

      const updated = updateSavingsGoal(initial, {
        name: "Japan Vacation",
        targetDate: "2027-05-01",
        accountId: aId,
        notes: "Flights & hotels",
      });

      expect(updated.name).toBe("Japan Vacation");
      expect(updated.targetDate).toBe("2027-05-01");
      expect(updated.accountId).toBe(aId);
      expect(updated.notes).toBe("Flights & hotels");
      expect(updated.version).toBe(2);
    });

    it("handles complete and uncomplete semantics", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Laptop",
        targetAmount: money(600000n, "PLN"),
      });

      const completed = completeSavingsGoal(goal);
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.version).toBe(2);

      const uncompleted = uncompleteSavingsGoal(completed);
      expect(uncompleted.status).toBe("active");
      expect(uncompleted.completedAt).toBeNull();
      expect(uncompleted.version).toBe(3);
    });

    it("handles archive and unarchive semantics", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Old Goal",
        targetAmount: money(100000n, "PLN"),
      });

      const archived = archiveSavingsGoal(goal);
      expect(archived.status).toBe("archived");
      expect(archived.archivedAt).toBeInstanceOf(Date);
      expect(archived.version).toBe(2);

      expect(() => updateSavingsGoal(archived, { name: "Cannot Update" })).toThrow(
        "Cannot update an archived savings goal",
      );

      const unarchived = unarchiveSavingsGoal(archived);
      expect(unarchived.status).toBe("active");
      expect(unarchived.archivedAt).toBeNull();
      expect(unarchived.version).toBe(3);
    });

    it("contributes to a savings goal with exact bigint arithmetic and auto-completes", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Emergency Fund",
        targetAmount: money(1000000n, "PLN"),
        currentAmount: money(800000n, "PLN"),
      });

      const afterFirst = contributeToSavingsGoal(goal, money(100000n, "PLN"));
      expect(afterFirst.currentAmount.amountMinor).toBe(900000n);
      expect(afterFirst.status).toBe("active");

      const afterSecond = contributeToSavingsGoal(afterFirst, money(150000n, "PLN"));
      expect(afterSecond.currentAmount.amountMinor).toBe(1050000n);
      expect(afterSecond.status).toBe("completed");
      expect(afterSecond.completedAt).not.toBeNull();
    });

    it("rejects invalid contributions", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Test",
        targetAmount: money(100000n, "PLN"),
      });

      expect(() => contributeToSavingsGoal(goal, money(0n, "PLN"))).toThrow(
        "strictly positive",
      );
      expect(() => contributeToSavingsGoal(goal, money(1000n, "EUR"))).toThrow(
        "does not match goal currency",
      );

      const archived = archiveSavingsGoal(goal);
      expect(() => contributeToSavingsGoal(archived, money(1000n, "PLN"))).toThrow(
        "Cannot contribute to an archived savings goal",
      );
    });
  });

  describe("Deterministic Contribution Formulas & Explanation", () => {
    it("handles goal without target date", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Rainy Day",
        targetAmount: money(1000000n, "PLN"),
        currentAmount: money(250000n, "PLN"),
      });

      const calc = calculateSavingsGoalContribution(goal, "2026-09-12");
      expect(calc.targetAmountMinor).toBe(1000000n);
      expect(calc.currentAmountMinor).toBe(250000n);
      expect(calc.remainingAmountMinor).toBe(750000n);
      expect(calc.isCompleted).toBe(false);
      expect(calc.isOverdue).toBe(false);
      expect(calc.progressBasisPoints).toBe(2500);
      expect(calc.progressPercentage).toBe(25);
      expect(calc.monthsRemaining).toBeNull();
      expect(calc.suggestedMonthlyContributionMinor).toBeNull();
      expect(calc.suggestedWeeklyContributionMinor).toBeNull();
      expect(calc.explanation.formula).toBe("no_target_date");
    });

    it("handles already completed goal", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Done Goal",
        targetAmount: money(100000n, "PLN"),
        currentAmount: money(100000n, "PLN"),
        targetDate: "2026-12-31",
      });

      const calc = calculateSavingsGoalContribution(goal, "2026-09-12");
      expect(calc.isCompleted).toBe(true);
      expect(calc.remainingAmountMinor).toBe(0n);
      expect(calc.progressPercentage).toBe(100);
      expect(calc.suggestedMonthlyContributionMinor).toBe(0n);
      expect(calc.suggestedWeeklyContributionMinor).toBe(0n);
      expect(calc.explanation.formula).toBe("already_completed");
    });

    it("handles overdue goal with remaining amount", () => {
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Past Goal",
        targetAmount: money(500000n, "PLN"),
        currentAmount: money(200000n, "PLN"),
        targetDate: "2026-08-01",
      });

      const calc = calculateSavingsGoalContribution(goal, "2026-09-12");
      expect(calc.isOverdue).toBe(true);
      expect(calc.isCompleted).toBe(false);
      expect(calc.remainingAmountMinor).toBe(300000n);
      // When overdue, the full remaining amount is needed
      expect(calc.suggestedMonthlyContributionMinor).toBe(300000n);
      expect(calc.suggestedWeeklyContributionMinor).toBe(300000n);
      expect(calc.explanation.formula).toBe("target_date_passed");
    });

    it("calculates exact ceiling periodic contributions to prevent shortfall", () => {
      // 100.00 PLN remaining (10000 minor) over 3 months
      // 10000 / 3 = 3333.333...
      // Ceiling division gives 3334 minor (33.34 PLN).
      // 3 * 33.34 = 100.02 PLN, guaranteeing the 100.00 PLN target is reached!
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Three Months Goal",
        targetAmount: money(10000n, "PLN"),
        currentAmount: money(0n, "PLN"),
        targetDate: "2026-12-12",
      });

      const calc = calculateSavingsGoalContribution(goal, "2026-09-12");
      expect(calc.monthsRemaining).toBe(3);
      expect(calc.remainingAmountMinor).toBe(10000n);
      expect(calc.suggestedMonthlyContributionMinor).toBe(3334n);
      // 3 * 3334n - 10000n = 2n round-up surplus
      expect(calc.explanation.monthlyRoundUpMinor).toBe(2n);
      expect(calc.explanation.formula).toBe("periodic_ceiling");
    });

    it("calculates weekly contribution accurately", () => {
      // 70.00 PLN remaining (7000 minor) over 14 days (2 weeks)
      const goal = createSavingsGoal({
        householdId: hId,
        name: "Two Weeks Goal",
        targetAmount: money(7000n, "PLN"),
        currentAmount: money(0n, "PLN"),
        targetDate: "2026-09-26",
      });

      const calc = calculateSavingsGoalContribution(goal, "2026-09-12");
      expect(calc.daysRemaining).toBe(14);
      expect(calc.weeksRemaining).toBe(2);
      expect(calc.suggestedWeeklyContributionMinor).toBe(3500n);
      expect(calc.explanation.weeklyRoundUpMinor).toBe(0n);
    });
  });
});
