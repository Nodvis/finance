import { z } from "zod";

import { calendarDateSchema } from "@/lib/obligations/schema";

export const monthKeyPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/;
export const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const overviewQuerySchema = z
  .object({
    month: z
      .string()
      .regex(monthKeyPattern, "Month must be in YYYY-MM format")
      .optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
  })
  .refine((value) => Boolean(value.from) === Boolean(value.to), {
    message: "Start and end dates must be provided together",
    path: ["to"],
  });

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

export type SerializedPeriod = {
  startDate: string;
  endDate: string;
  monthKey: string | null;
  prevMonthKey: string;
  nextMonthKey: string;
};

export type SerializedCurrencyAvailableCash = {
  currency: string;
  amountMinor: string;
  freshAccountCount: number;
  missingAccountCount: number;
  staleAccountCount: number;
  isComplete: boolean;
};

export type SerializedMissingAccount = {
  id: string;
  name: string;
  currency: string;
};

export type SerializedStaleAccount = {
  id: string;
  name: string;
  currency: string;
  capturedAt: string;
};

export type SerializedAvailableCashSummary = {
  byCurrency: SerializedCurrencyAvailableCash[];
  missingAccounts: SerializedMissingAccount[];
  staleAccounts: SerializedStaleAccount[];
  totalEligibleAccounts: number;
  freshAccountsCount: number;
  isFullyKnown: boolean;
};

export type SerializedCurrencyCashFlow = {
  currency: string;
  incomeMinor: string;
  spendingMinor: string;
  netCashFlowMinor: string;
  transactionCount: number;
};

export type SerializedCategorySpending = {
  categoryId: string | null;
  categoryName: string | null;
  currency: string;
  amountMinor: string;
  transactionCount: number;
  percentage: number;
};

export type SerializedUpcomingObligationsSummary = {
  upcomingCount: number;
  overdueCount: number;
  paidCount: number;
  upcomingByCurrency: Array<{
    currency: string;
    totalMinor: string;
  }>;
  overdueByCurrency: Array<{
    currency: string;
    totalMinor: string;
  }>;
};

export type SerializedHouseholdOverview = {
  householdId: string;
  period: SerializedPeriod;
  availableCash: SerializedAvailableCashSummary;
  cashFlow: {
    byCurrency: SerializedCurrencyCashFlow[];
    totalTransactionsCount: number;
  };
  categorySpending: SerializedCategorySpending[];
  upcoming?: SerializedUpcomingObligationsSummary | undefined;
};
