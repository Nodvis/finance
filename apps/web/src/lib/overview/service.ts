import "server-only";

import {
  getHouseholdEligibleAccounts,
  getHouseholdPeriodCashFlow,
  getHouseholdPeriodCategorySpending,
  isPersonInHousehold,
} from "@nodvis/finance-db";
import {
  DEFAULT_STALE_SNAPSHOT_THRESHOLD_DAYS,
  accountId as toAccountId,
  aggregateAvailableCash,
  createMonthPeriod,
  createPeriod,
  currencyCode,
  formatMonthKey,
  getAdjacentMonthKey,
  money,
  parseMonthKey,
} from "@nodvis/finance-domain";
import type {
  AvailableCashAccountInput,
  AvailableCashSummary,
  CurrencyCashFlow,
  HouseholdId,
  Period,
  PersonId,
} from "@nodvis/finance-domain";

import type { OverviewQuery } from "./schema";

export class HouseholdAccessDeniedError extends Error {
  constructor(message: string = "Household access denied") {
    super(message);
    this.name = "HouseholdAccessDeniedError";
  }
}

export type AuthorizedHouseholdContext = Readonly<{
  authUserId: string;
  householdId: HouseholdId;
  personId: PersonId;
}>;

export type HouseholdContext = AuthorizedHouseholdContext;

export type HouseholdOverview = {
  householdId: string;
  period: {
    startDate: Date;
    endDate: Date;
    monthKey: string | null;
    prevMonthKey: string;
    nextMonthKey: string;
  };
  availableCash: AvailableCashSummary;
  cashFlow: {
    byCurrency: readonly CurrencyCashFlow[];
    totalTransactionsCount: number;
  };
  categorySpending: readonly {
    categoryId: string | null;
    categoryName: string | null;
    currency: string;
    amountMinor: bigint;
    transactionCount: number;
    percentage: number;
  }[];
};

export async function getHouseholdOverview(
  context: HouseholdContext,
  query?: OverviewQuery,
  options?: { asOf?: Date; staleThresholdDays?: number },
): Promise<HouseholdOverview> {
  const isMember = await isPersonInHousehold(
    context.householdId,
    context.personId,
  );
  if (!isMember) {
    throw new HouseholdAccessDeniedError(
      `Person ${context.personId} is not a member of household ${context.householdId}`,
    );
  }

  const asOf = options?.asOf ?? new Date();

  // Resolve explicit period
  let period: Period;
  let monthKey: string | null = null;

  if (query?.month) {
    const { year, month } = parseMonthKey(query.month);
    period = createMonthPeriod(year, month);
    monthKey = query.month;
  } else if (query?.from && query?.to) {
    period = createPeriod(query.from, query.to);
    monthKey = null;
  } else {
    const year = asOf.getUTCFullYear();
    const month = asOf.getUTCMonth() + 1;
    period = createMonthPeriod(year, month);
    monthKey = formatMonthKey(year, month);
  }

  const baseMonthKey =
    monthKey ??
    formatMonthKey(
      period.startDate.getUTCFullYear(),
      period.startDate.getUTCMonth() + 1,
    );
  const prevMonthKey = getAdjacentMonthKey(baseMonthKey, -1);
  const nextMonthKey = getAdjacentMonthKey(baseMonthKey, 1);

  // Execute database queries
  const [cashFlowRows, categoryRows, accountRows] = await Promise.all([
    getHouseholdPeriodCashFlow({
      householdId: context.householdId,
      startDate: period.startDate,
      endDate: period.endDate,
    }),
    getHouseholdPeriodCategorySpending({
      householdId: context.householdId,
      startDate: period.startDate,
      endDate: period.endDate,
    }),
    getHouseholdEligibleAccounts(context.householdId),
  ]);

  // Aggregate Available Cash with honesty regarding stale and missing observations
  const domainAccounts: AvailableCashAccountInput[] = accountRows.map((a) => ({
    id: toAccountId(a.id),
    name: a.name,
    type: a.type,
    currency: a.currency,
    balanceSnapshot:
      a.balanceSnapshotMinor !== null && a.balanceSnapshotAt !== null
        ? {
            balance: money(a.balanceSnapshotMinor, a.currency),
            capturedAt: a.balanceSnapshotAt,
          }
        : null,
    archivedAt: null,
  }));

  const availableCash = aggregateAvailableCash(domainAccounts, {
    asOf,
    thresholdMs:
      (options?.staleThresholdDays ?? DEFAULT_STALE_SNAPSHOT_THRESHOLD_DAYS) *
      24 *
      60 *
      60 *
      1000,
  });

  // Aggregate Cash Flow
  const cashFlowByCurrencyMap = new Map<
    string,
    { incomeMinor: bigint; spendingMinor: bigint; count: number }
  >();
  let totalTransactionsCount = 0;

  for (const row of cashFlowRows) {
    let entry = cashFlowByCurrencyMap.get(row.currency);
    if (!entry) {
      entry = { incomeMinor: 0n, spendingMinor: 0n, count: 0 };
      cashFlowByCurrencyMap.set(row.currency, entry);
    }
    entry.count += row.transactionCount;
    totalTransactionsCount += row.transactionCount;

    if (row.kind === "income") {
      entry.incomeMinor += row.totalMinor;
    } else if (row.kind === "expense") {
      entry.spendingMinor += row.totalMinor;
    }
  }

  const byCurrency: CurrencyCashFlow[] = Array.from(
    cashFlowByCurrencyMap.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([curr, data]) =>
      Object.freeze({
        currency: currencyCode(curr),
        incomeMinor: data.incomeMinor,
        spendingMinor: data.spendingMinor,
        netCashFlowMinor: data.incomeMinor - data.spendingMinor,
        transactionCount: data.count,
      }),
    );

  // Compute category spending with percentages per currency
  const categorySpending = categoryRows.map((row) => {
    const currencyTotals = cashFlowByCurrencyMap.get(row.currency);
    const totalSpending = currencyTotals?.spendingMinor ?? 0n;
    let percentage = 0;

    if (totalSpending > 0n && row.totalMinor > 0n) {
      const bps = Number((row.totalMinor * 10000n) / totalSpending);
      percentage = Math.round(bps) / 100;
    }

    return Object.freeze({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      currency: row.currency,
      amountMinor: row.totalMinor,
      transactionCount: row.transactionCount,
      percentage,
    });
  });

  return Object.freeze({
    householdId: context.householdId,
    period: Object.freeze({
      startDate: period.startDate,
      endDate: period.endDate,
      monthKey,
      prevMonthKey,
      nextMonthKey,
    }),
    availableCash,
    cashFlow: Object.freeze({
      byCurrency: Object.freeze(byCurrency),
      totalTransactionsCount,
    }),
    categorySpending: Object.freeze(categorySpending),
  });
}
