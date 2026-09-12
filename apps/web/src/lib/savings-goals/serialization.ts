import {
  calculateSavingsGoalContribution,
  type SavingsGoalContributionCalculation,
  type SavingsGoalStatus,
} from "@nodvis/finance-domain";
import {
  mapSummaryToDomain,
  type HouseholdSavingsGoalSummary,
} from "@nodvis/finance-db";

export type SerializedSavingsGoalCalculationExplanation = {
  formula: "no_target_date" | "already_completed" | "target_date_passed" | "periodic_ceiling";
  monthsRemaining: number | null;
  weeksRemaining: number | null;
  remainingAmountMinor: string;
  monthlyContributionMinor: string | null;
  weeklyContributionMinor: string | null;
  monthlyRoundUpMinor: string;
  weeklyRoundUpMinor: string;
};

export type SerializedSavingsGoalContributionCalculation = {
  targetAmountMinor: string;
  currentAmountMinor: string;
  remainingAmountMinor: string;
  currency: string;
  isCompleted: boolean;
  isOverdue: boolean;
  progressBasisPoints: number;
  progressPercentage: number;
  targetDate: string | null;
  asOfDate: string;
  daysRemaining: number | null;
  monthsRemaining: number | null;
  weeksRemaining: number | null;
  suggestedMonthlyContributionMinor: string | null;
  suggestedWeeklyContributionMinor: string | null;
  explanation: SerializedSavingsGoalCalculationExplanation;
};

export type SerializedSavingsGoal = {
  id: string;
  householdId: string;
  name: string;
  targetAmountMinor: string;
  currentAmountMinor: string;
  currency: string;
  targetDate: string | null;
  accountId: string | null;
  accountName: string | null;
  status: SavingsGoalStatus;
  notes: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  calculation: SerializedSavingsGoalContributionCalculation;
};

export type SerializedSavingsGoalsOverviewSummary = {
  totalGoalsCount: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  byCurrency: Array<{
    currency: string;
    targetTotalMinor: string;
    currentTotalMinor: string;
    remainingTotalMinor: string;
    suggestedMonthlyMinor: string;
  }>;
  goals: SerializedSavingsGoal[];
};

export function serializeSavingsGoalCalculation(
  calc: SavingsGoalContributionCalculation,
): SerializedSavingsGoalContributionCalculation {
  return {
    targetAmountMinor: calc.targetAmountMinor.toString(),
    currentAmountMinor: calc.currentAmountMinor.toString(),
    remainingAmountMinor: calc.remainingAmountMinor.toString(),
    currency: calc.currency,
    isCompleted: calc.isCompleted,
    isOverdue: calc.isOverdue,
    progressBasisPoints: calc.progressBasisPoints,
    progressPercentage: calc.progressPercentage,
    targetDate: calc.targetDate,
    asOfDate: calc.asOfDate,
    daysRemaining: calc.daysRemaining,
    monthsRemaining: calc.monthsRemaining,
    weeksRemaining: calc.weeksRemaining,
    suggestedMonthlyContributionMinor:
      calc.suggestedMonthlyContributionMinor !== null
        ? calc.suggestedMonthlyContributionMinor.toString()
        : null,
    suggestedWeeklyContributionMinor:
      calc.suggestedWeeklyContributionMinor !== null
        ? calc.suggestedWeeklyContributionMinor.toString()
        : null,
    explanation: {
      formula: calc.explanation.formula,
      monthsRemaining: calc.explanation.monthsRemaining,
      weeksRemaining: calc.explanation.weeksRemaining,
      remainingAmountMinor: calc.explanation.remainingAmountMinor.toString(),
      monthlyContributionMinor:
        calc.explanation.monthlyContributionMinor !== null
          ? calc.explanation.monthlyContributionMinor.toString()
          : null,
      weeklyContributionMinor:
        calc.explanation.weeklyContributionMinor !== null
          ? calc.explanation.weeklyContributionMinor.toString()
          : null,
      monthlyRoundUpMinor: calc.explanation.monthlyRoundUpMinor.toString(),
      weeklyRoundUpMinor: calc.explanation.weeklyRoundUpMinor.toString(),
    },
  };
}

export function serializeSavingsGoal(
  goal: HouseholdSavingsGoalSummary,
  asOfDate?: string,
): SerializedSavingsGoal {
  const domainGoal = mapSummaryToDomain(goal);
  const calculation = calculateSavingsGoalContribution(domainGoal, asOfDate);

  return {
    id: goal.id,
    householdId: goal.householdId,
    name: goal.name,
    targetAmountMinor: goal.targetAmountMinor.toString(),
    currentAmountMinor: goal.currentAmountMinor.toString(),
    currency: goal.currency,
    targetDate: goal.targetDate,
    accountId: goal.accountId,
    accountName: goal.accountName ?? null,
    status: goal.status,
    notes: goal.notes,
    completedAt: goal.completedAt?.toISOString() ?? null,
    archivedAt: goal.archivedAt?.toISOString() ?? null,
    version: goal.version,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    calculation: serializeSavingsGoalCalculation(calculation),
  };
}

export function buildSavingsGoalsOverviewSummary(
  goals: HouseholdSavingsGoalSummary[],
  asOfDate?: string,
): SerializedSavingsGoalsOverviewSummary {
  const serialized = goals.map((g) => serializeSavingsGoal(g, asOfDate));
  const activeGoals = serialized.filter((g) => g.status === "active");
  const completedGoals = serialized.filter((g) => g.status === "completed");

  const currencyMap = new Map<
    string,
    {
      targetTotal: bigint;
      currentTotal: bigint;
      remainingTotal: bigint;
      suggestedMonthly: bigint;
    }
  >();

  for (const goal of activeGoals) {
    const cur = currencyMap.get(goal.currency) ?? {
      targetTotal: 0n,
      currentTotal: 0n,
      remainingTotal: 0n,
      suggestedMonthly: 0n,
    };
    cur.targetTotal += BigInt(goal.targetAmountMinor);
    cur.currentTotal += BigInt(goal.currentAmountMinor);
    cur.remainingTotal += BigInt(goal.calculation.remainingAmountMinor);
    if (goal.calculation.suggestedMonthlyContributionMinor) {
      cur.suggestedMonthly += BigInt(
        goal.calculation.suggestedMonthlyContributionMinor,
      );
    }
    currencyMap.set(goal.currency, cur);
  }

  const byCurrency = Array.from(currencyMap.entries()).map(([curr, agg]) => ({
    currency: curr,
    targetTotalMinor: agg.targetTotal.toString(),
    currentTotalMinor: agg.currentTotal.toString(),
    remainingTotalMinor: agg.remainingTotal.toString(),
    suggestedMonthlyMinor: agg.suggestedMonthly.toString(),
  }));

  return {
    totalGoalsCount: goals.length,
    activeGoalsCount: activeGoals.length,
    completedGoalsCount: completedGoals.length,
    byCurrency,
    goals: serialized,
  };
}
