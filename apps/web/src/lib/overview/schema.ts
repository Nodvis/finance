import { z } from "zod";

export const monthKeyPattern = /^\d{4}-(?:0[1-9]|1[0-2])$/;
export const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const overviewQuerySchema = z.object({
  month: z
    .string()
    .regex(monthKeyPattern, "Month must be in YYYY-MM format")
    .optional(),
  from: z
    .string()
    .regex(datePattern, "Start date must be in YYYY-MM-DD format")
    .optional(),
  to: z
    .string()
    .regex(datePattern, "End date must be in YYYY-MM-DD format")
    .optional(),
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

export type SerializedHouseholdOverview = {
  householdId: string;
  period: SerializedPeriod;
  availableCash: SerializedAvailableCashSummary;
  cashFlow: {
    byCurrency: SerializedCurrencyCashFlow[];
    totalTransactionsCount: number;
  };
  categorySpending: SerializedCategorySpending[];
};
