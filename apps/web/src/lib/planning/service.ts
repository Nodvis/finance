import "server-only";

import { aggregateMonthlyIncome, buildPlanningSuggestions, PLANNING_STRATEGIES, type PlanningResult, type PlanningStrategy } from "@nodvis/finance-domain";
import { listBudgetsByHousehold, listLiabilitiesByHousehold, listHouseholdAnalyticsTransactions } from "@nodvis/finance-db";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { isPersonInHousehold } from "@nodvis/finance-db";
import { getHouseholdCashForecast } from "@/lib/forecast/service";
import { listSavingsGoalsByHousehold } from "@nodvis/finance-db";

export async function getHouseholdPlanning(
  context: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">,
  input: { strategy: PlanningStrategy; month: string; asOf: string; horizonDays: 7 | 30 },
): Promise<PlanningResult> {
  if (!(await isPersonInHousehold(context.householdId, context.personId))) throw new Error("Household access denied");
  const forecast = await getHouseholdCashForecast(context, { asOf: input.asOf, horizonDays: input.horizonDays });
  const monthStart = new Date(`${input.month}-01T00:00:00.000Z`);
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  nextMonth.setUTCMilliseconds(-1);
  const [budgets, goals, debts, transactions] = await Promise.all([
    listBudgetsByHousehold(context.householdId, input.month, false),
    listSavingsGoalsByHousehold(context.householdId, { includeArchived: false }),
    listLiabilitiesByHousehold(context.householdId, { includeArchived: false }),
    listHouseholdAnalyticsTransactions(context.householdId, monthStart, nextMonth),
  ]);
  const monthlyIncome = aggregateMonthlyIncome(transactions.filter((row) => row.kind === "income"));
  return buildPlanningSuggestions({
    strategy: input.strategy,
    forecast,
    budgets: budgets.map((b) => ({ currency: b.currency, limitAmountMinor: b.limitAmountMinor, remainingAmountMinor: b.remainingAmountMinor })),
    goals: goals.filter((g) => g.status === "active").map((g) => ({ currency: g.currency, remainingMinor: g.targetAmountMinor - g.currentAmountMinor, targetDate: g.targetDate })),
    debts: debts.filter((d) => d.observedOutstandingMinor !== null).map((d) => ({ id: d.id, currency: d.currency, outstandingMinor: d.observedOutstandingMinor! < 0n ? -d.observedOutstandingMinor! : d.observedOutstandingMinor! })),
    monthlyIncome,
  });
}

export { PLANNING_STRATEGIES };
