import type { CategoryId, HouseholdId } from "./identity";
import { budgetId } from "./identity";
import type { CurrencyCode, Money } from "./money";
import { money } from "./money";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export type Budget = Readonly<{ id: ReturnType<typeof budgetId>; householdId: HouseholdId; categoryId: CategoryId; month: string; limit: Money; archivedAt: Date | null; version: number }>;
export type BudgetCalculation = Readonly<{ limitAmountMinor: bigint; spentAmountMinor: bigint; remainingAmountMinor: bigint; isOverBudget: boolean }>;
export function validateBudgetMonth(month: string): string { if (!MONTH_RE.test(month)) throw new Error("Budget month must be YYYY-MM"); return month; }
export function createBudget(input: { id?: ReturnType<typeof budgetId>; householdId: HouseholdId; categoryId: CategoryId; month: string; limit: Money; archivedAt?: Date | null; version?: number }): Budget {
  if (input.limit.amountMinor <= 0n) throw new Error("Budget limit must be strictly positive");
  validateBudgetMonth(input.month);
  return Object.freeze({ id: input.id ?? budgetId(crypto.randomUUID()), householdId: input.householdId, categoryId: input.categoryId, month: input.month, limit: money(input.limit.amountMinor, input.limit.currency), archivedAt: input.archivedAt ?? null, version: input.version ?? 1 });
}
export function calculateBudget(limit: Money, spent: Money): BudgetCalculation {
  if (limit.currency !== spent.currency) throw new Error("Budget and spending currencies must match");
  const remaining = limit.amountMinor - spent.amountMinor;
  return Object.freeze({ limitAmountMinor: limit.amountMinor, spentAmountMinor: spent.amountMinor, remainingAmountMinor: remaining, isOverBudget: remaining < 0n });
}
export function updateBudget(existing: Budget, input: { month?: string; limit?: Money }): Budget {
  if (existing.archivedAt) throw new Error("Cannot update an archived budget");
  const month = input.month ?? existing.month; validateBudgetMonth(month);
  const limit = input.limit ?? existing.limit;
  if (limit.currency !== existing.limit.currency) throw new Error("Budget currency cannot change");
  if (limit.amountMinor <= 0n) throw new Error("Budget limit must be strictly positive");
  return Object.freeze({ ...existing, month, limit, version: existing.version + 1 });
}
export function archiveBudget(existing: Budget, archivedAt = new Date()): Budget { if (existing.archivedAt) return existing; return Object.freeze({ ...existing, archivedAt, version: existing.version + 1 }); }
