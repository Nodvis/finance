import type { HouseholdOverview } from "./service";
import type { SerializedHouseholdOverview } from "./schema";

export function serializeOverview(
  overview: HouseholdOverview,
): SerializedHouseholdOverview {
  return {
    householdId: overview.householdId,
    period: {
      startDate: overview.period.startDate.toISOString(),
      endDate: overview.period.endDate.toISOString(),
      monthKey: overview.period.monthKey,
      prevMonthKey: overview.period.prevMonthKey,
      nextMonthKey: overview.period.nextMonthKey,
    },
    availableCash: {
      byCurrency: overview.availableCash.byCurrency.map((c) => ({
        currency: c.currency,
        amountMinor: c.amountMinor.toString(),
        freshAccountCount: c.freshAccountCount,
        missingAccountCount: c.missingAccountCount,
        staleAccountCount: c.staleAccountCount,
        isComplete: c.isComplete,
      })),
      missingAccounts: overview.availableCash.missingAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
      })),
      staleAccounts: overview.availableCash.staleAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        capturedAt: a.capturedAt.toISOString(),
      })),
      totalEligibleAccounts: overview.availableCash.totalEligibleAccounts,
      freshAccountsCount: overview.availableCash.freshAccountsCount,
      isFullyKnown: overview.availableCash.isFullyKnown,
    },
    cashFlow: {
      byCurrency: overview.cashFlow.byCurrency.map((c) => ({
        currency: c.currency,
        incomeMinor: c.incomeMinor.toString(),
        spendingMinor: c.spendingMinor.toString(),
        netCashFlowMinor: c.netCashFlowMinor.toString(),
        transactionCount: c.transactionCount,
      })),
      totalTransactionsCount: overview.cashFlow.totalTransactionsCount,
    },
    categorySpending: overview.categorySpending.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      currency: cat.currency,
      amountMinor: cat.amountMinor.toString(),
      transactionCount: cat.transactionCount,
      percentage: cat.percentage,
    })),
    upcoming: overview.upcoming
      ? {
          upcomingCount: overview.upcoming.upcomingCount,
          overdueCount: overview.upcoming.overdueCount,
          paidCount: overview.upcoming.paidCount,
          upcomingByCurrency: overview.upcoming.upcomingByCurrency.map((c) => ({
            currency: c.currency,
            totalMinor: c.totalMinor.toString(),
          })),
          overdueByCurrency: overview.upcoming.overdueByCurrency.map((c) => ({
            currency: c.currency,
            totalMinor: c.totalMinor.toString(),
          })),
        }
      : undefined,
  };
}
