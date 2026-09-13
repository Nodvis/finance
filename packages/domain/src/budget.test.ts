import { describe, expect, it } from "vitest";
import { calculateBudget, createBudget } from "./budget";
import { categoryId, householdId } from "./identity";
import { money } from "./money";
describe("budget", () => {
  it("computes exact remaining and over budget", () => { const result = calculateBudget(money(10000000000000001n, "PLN"), money(10000000000000002n, "PLN")); expect(result.remainingAmountMinor).toBe(-1n); expect(result.isOverBudget).toBe(true); });
  it("rejects invalid month and currency mismatch", () => { expect(() => createBudget({ householdId: householdId("00000000-0000-4000-8000-000000000001"), categoryId: categoryId("00000000-0000-4000-8000-000000000002"), month: "2026-02", limit: money(1n, "PLN") })).not.toThrow(); expect(() => createBudget({ householdId: householdId("00000000-0000-4000-8000-000000000001"), categoryId: categoryId("00000000-0000-4000-8000-000000000002"), month: "2026-2", limit: money(1n, "PLN") })).toThrow(); expect(() => calculateBudget(money(1n, "PLN"), money(1n, "EUR"))).toThrow(); });
});
