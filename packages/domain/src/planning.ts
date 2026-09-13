import type { CashForecast } from "./forecast";
import { currencyCode, type CurrencyCode } from "./money";
import { isValidCalendarDate } from "./calendar-date";

export const PLANNING_STRATEGIES = ["stabilization", "50-30-20", "pay-yourself-first", "debt-avalanche", "debt-snowball", "sinking-fund"] as const;
export type PlanningStrategy = (typeof PLANNING_STRATEGIES)[number];
export type PlanningInput = Readonly<{
  strategy: PlanningStrategy;
  forecast: CashForecast;
  budgets: readonly { currency: string; limitAmountMinor: bigint; remainingAmountMinor: bigint }[];
  goals: readonly { currency: string; remainingMinor: bigint; targetDate?: string | null }[];
  debts: readonly { id?: string; currency: string; outstandingMinor: bigint; annualInterestRateBps?: bigint | null }[];
  monthlyIncome?: readonly { currency: string; amountMinor: bigint }[];
}>;
export type PlanningSuggestion = Readonly<{ code: string; amountMinor?: string; debtId?: string }>;
export type PlanningCurrency = Readonly<{ currency: CurrencyCode; projectedCashMinor: string; status: "positive" | "zero" | "deficit" | "incomplete"; suggestions: readonly PlanningSuggestion[] }>;
export type PlanningResult = Readonly<{ strategy: PlanningStrategy; byCurrency: readonly PlanningCurrency[]; hasData: boolean }>;

export function aggregateMonthlyIncome(rows: readonly { id: string; currency: string; amountMinor: bigint }[]): readonly { currency: string; amountMinor: bigint }[] {
  const byTransaction = new Map<string, { currency: string; amountMinor: bigint }>();
  for (const row of rows) if (!byTransaction.has(row.id)) byTransaction.set(row.id, row);
  const byCurrency = new Map<string, bigint>();
  for (const row of byTransaction.values()) byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0n) + row.amountMinor);
  return [...byCurrency.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

export function buildPlanningSuggestions(input: PlanningInput): PlanningResult {
  const byCurrency = input.forecast.byCurrency.map((item) => {
    const currency = currencyCode(item.currency);
    const goals = input.goals.filter((x) => currencyCode(x.currency) === currency && x.remainingMinor > 0n);
    const debts = input.debts.filter((x) => currencyCode(x.currency) === currency && x.outstandingMinor > 0n);
    const income = input.monthlyIncome?.find((x) => currencyCode(x.currency) === currency);
    const overBudget = input.budgets.some((x) => currencyCode(x.currency) === currency && x.remainingAmountMinor < 0n);
    const suggestions: PlanningSuggestion[] = [];
    if (overBudget && item.isComplete) suggestions.push({ code: "review-over-budget" });
    if (!item.isComplete) suggestions.push({ code: "verify-cash" });
    else if (item.projectedCashMinor < 0n) suggestions.push({ code: "protect-buffer", amountMinor: "0" });
    else if (item.projectedCashMinor > 0n) {
      switch (input.strategy) {
        case "50-30-20":
          if (income) suggestions.push({ code: "needs-benchmark", amountMinor: ((income.amountMinor * 50n) / 100n).toString() }, { code: "wants-benchmark", amountMinor: ((income.amountMinor * 30n) / 100n).toString() }, { code: "savings-benchmark", amountMinor: ((income.amountMinor * 20n) / 100n).toString() });
          else suggestions.push({ code: "missing-income" });
          break;
        case "pay-yourself-first":
          if (goals.length) suggestions.push({ code: "fund-goals-first", amountMinor: boundedContribution(item.projectedCashMinor, income?.amountMinor, monthlyGoalNeed(goals, input.forecast.asOf)).toString() });
          else suggestions.push({ code: "set-savings-goal" });
          break;
        case "debt-avalanche":
          if (debts.length === 0) suggestions.push({ code: "no-debt-data" });
          else if (debts.every((debt) => debt.annualInterestRateBps !== undefined && debt.annualInterestRateBps !== null)) {
            const highestCost = debts.reduce((current, debt) => debt.annualInterestRateBps! > current.annualInterestRateBps! || (debt.annualInterestRateBps === current.annualInterestRateBps && (debt.id ?? "") < (current.id ?? "")) ? debt : current);
            suggestions.push({ code: "prioritize-high-cost-debt", ...(highestCost.id ? { debtId: highestCost.id } : {}), amountMinor: highestCost.outstandingMinor.toString() });
          } else suggestions.push({ code: "missing-rate-data" });
          if (goals.length) suggestions.push({ code: "fund-goals-after-debt" });
          break;
        case "debt-snowball":
          if (debts.length) {
            const smallest = debts.reduce((current, debt) => debt.outstandingMinor < current.outstandingMinor || (debt.outstandingMinor === current.outstandingMinor && (debt.id ?? "") < (current.id ?? "")) ? debt : current);
            suggestions.push({ code: "prioritize-smallest-debt", ...(smallest.id ? { debtId: smallest.id } : {}), amountMinor: smallest.outstandingMinor.toString() });
          } else suggestions.push({ code: "no-debt-data" });
          break;
        case "sinking-fund":
          suggestions.push(goals.length ? { code: "fund-sinking-goals", amountMinor: boundedContribution(item.projectedCashMinor, income?.amountMinor, monthlyGoalNeed(goals, input.forecast.asOf)).toString() } : { code: "set-sinking-goal" });
          break;
        default:
          suggestions.push({ code: "protect-buffer", amountMinor: item.projectedCashMinor.toString() });
      }
    } else suggestions.push({ code: "protect-buffer", amountMinor: "0" });
    return { currency, projectedCashMinor: item.projectedCashMinor.toString(), status: item.status, suggestions };
  }).sort((a, b) => a.currency.localeCompare(b.currency));
  return { strategy: input.strategy, byCurrency, hasData: byCurrency.length > 0 };
}

function boundedContribution(projectedCashMinor: bigint, monthlyIncomeMinor: bigint | undefined, remainingMinor: bigint): bigint {
  let amount = projectedCashMinor > 0n ? projectedCashMinor : 0n;
  if (monthlyIncomeMinor !== undefined && monthlyIncomeMinor > 0n) amount = amount < monthlyIncomeMinor ? amount : monthlyIncomeMinor;
  return amount < remainingMinor ? amount : remainingMinor;
}

function monthlyGoalNeed(goals: readonly { remainingMinor: bigint; targetDate?: string | null }[], asOf: string): bigint {
  return goals.reduce((total, goal) => {
    if (!goal.targetDate || !isValidCalendarDate(goal.targetDate) || goal.targetDate <= asOf) return total + goal.remainingMinor;
    const [year, month] = asOf.split("-").map(Number);
    const [targetYear, targetMonth] = goal.targetDate.split("-").map(Number);
    const months = Math.max(1, (targetYear! - year!) * 12 + targetMonth! - month!);
    return total + (goal.remainingMinor + BigInt(months) - 1n) / BigInt(months);
  }, 0n);
}
