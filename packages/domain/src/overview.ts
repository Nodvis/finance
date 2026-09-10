import type { ExpenseTransaction, Transaction } from "./transaction";
import { contributesToAvailableCash } from "./account";
import type { AccountBalanceSnapshot, AccountType } from "./account";
import type { AccountId, CategoryId } from "./identity";
import type { CurrencyCode } from "./money";
import { currencyCode } from "./money";
import { isVoided } from "./transaction";

export type Period = Readonly<{
  startDate: Date;
  endDate: Date;
}>;

export const DEFAULT_STALE_SNAPSHOT_THRESHOLD_DAYS = 30;
export const DEFAULT_STALE_SNAPSHOT_THRESHOLD_MS =
  DEFAULT_STALE_SNAPSHOT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Validates and constructs an explicit period with inclusive UTC boundaries.
 */
export function createPeriod(
  startDateInput: Date | string,
  endDateInput: Date | string,
): Period {
  const startDate =
    typeof startDateInput === "string"
      ? parseExplicitUtcDate(startDateInput, "start")
      : new Date(startDateInput);
  const endDate =
    typeof endDateInput === "string"
      ? parseExplicitUtcDate(endDateInput, "end")
      : new Date(endDateInput);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error(`Invalid start date: ${startDateInput}`);
  }
  if (Number.isNaN(endDate.getTime())) {
    throw new Error(`Invalid end date: ${endDateInput}`);
  }
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error(
      `Invalid period: startDate (${startDate.toISOString()}) cannot be after endDate (${endDate.toISOString()})`,
    );
  }

  return Object.freeze({
    startDate: new Date(startDate.getTime()),
    endDate: new Date(endDate.getTime()),
  });
}

/**
 * Parses YYYY-MM-DD string into explicit UTC boundary:
 * - "start": 00:00:00.000Z
 * - "end": 23:59:59.999Z
 * If already an ISO string with time (contains 'T'), parses directly.
 */
function parseExplicitUtcDate(
  value: string,
  boundary: "start" | "end",
): Date {
  const trimmed = value.trim();
  const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(dateOnlyPattern);

  if (match) {
    const year = Number.parseInt(match[1]!, 10);
    const month = Number.parseInt(match[2]!, 10);
    const day = Number.parseInt(match[3]!, 10);

    if (boundary === "start") {
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    } else {
      return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    }
  }

  return new Date(trimmed);
}

/**
 * Creates an explicit calendar month period in UTC:
 * Starts on first day 00:00:00.000Z, ends on last day 23:59:59.999Z.
 * Month is 1-indexed (1 = January, 12 = December).
 */
export function createMonthPeriod(year: number, month: number): Period {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error(`Invalid year: ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month (must be 1-12): ${month}`);
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  // Day 0 of next month is the last day of current month in UTC
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return Object.freeze({
    startDate,
    endDate,
  });
}

export function isDateInPeriod(date: Date, period: Period): boolean {
  if (!date || Number.isNaN(date.getTime())) {
    return false;
  }
  const time = date.getTime();
  return time >= period.startDate.getTime() && time <= period.endDate.getTime();
}

export function formatMonthKey(year: number, month: number): string {
  const m = String(month).padStart(2, "0");
  return `${year}-${m}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const pattern = /^(\d{4})-(\d{2})$/;
  const match = monthKey.trim().match(pattern);
  if (!match) {
    throw new Error(`Invalid month format (expected YYYY-MM): ${monthKey}`);
  }
  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month number in month key: ${monthKey}`);
  }
  return { year, month };
}

export function getAdjacentMonthKey(
  monthKey: string,
  deltaMonths: number,
): string {
  const { year, month } = parseMonthKey(monthKey);
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return formatMonthKey(newYear, newMonth);
}

/**
 * Determines whether a snapshot timestamp is considered stale relative to an as-of date.
 */
export function isSnapshotStale(
  capturedAt: Date,
  asOf: Date = new Date(),
  thresholdMs: number = DEFAULT_STALE_SNAPSHOT_THRESHOLD_MS,
): boolean {
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) {
    return true;
  }
  const elapsed = asOf.getTime() - capturedAt.getTime();
  return elapsed < 0 || elapsed > thresholdMs;
}

export type AvailableCashAccountInput = Readonly<{
  id: AccountId;
  name: string;
  type: AccountType;
  currency: CurrencyCode | string;
  balanceSnapshot: AccountBalanceSnapshot | null;
  archivedAt: Date | null;
}>;

export type CurrencyAvailableCash = Readonly<{
  currency: CurrencyCode;
  amountMinor: bigint;
  freshAccountCount: number;
  missingAccountCount: number;
  staleAccountCount: number;
  isComplete: boolean;
}>;

export type AvailableCashSummary = Readonly<{
  byCurrency: readonly CurrencyAvailableCash[];
  missingAccounts: readonly Readonly<{
    id: AccountId;
    name: string;
    currency: CurrencyCode;
  }>[];
  staleAccounts: readonly Readonly<{
    id: AccountId;
    name: string;
    currency: CurrencyCode;
    capturedAt: Date;
  }>[];
  totalEligibleAccounts: number;
  freshAccountsCount: number;
  isFullyKnown: boolean;
}>;

/**
 * Aggregates available cash across eligible asset accounts.
 *
 * Rules:
 * - Only active (non-archived) asset accounts contribute (checking, savings, cash).
 * - Credit cards are strictly excluded (INV-013).
 * - Stale snapshots (> threshold) are excluded from aggregated cash and reported honestly.
 * - Missing snapshots are excluded from aggregated cash and reported honestly.
 * - Grouped by currency without combining or exchange rates.
 * - Exact bigint arithmetic.
 */
export function aggregateAvailableCash(
  accounts: readonly AvailableCashAccountInput[],
  options?: { asOf?: Date; thresholdMs?: number },
): AvailableCashSummary {
  const asOf = options?.asOf ?? new Date();
  const thresholdMs =
    options?.thresholdMs ?? DEFAULT_STALE_SNAPSHOT_THRESHOLD_MS;

  const eligibleAccounts = accounts.filter(
    (acc) => acc.archivedAt === null && contributesToAvailableCash(acc.type),
  );

  const missingAccounts: Array<{
    id: AccountId;
    name: string;
    currency: CurrencyCode;
  }> = [];

  const staleAccounts: Array<{
    id: AccountId;
    name: string;
    currency: CurrencyCode;
    capturedAt: Date;
  }> = [];

  const totalsByCurrency = new Map<
    CurrencyCode,
    {
      amountMinor: bigint;
      freshCount: number;
      missingCount: number;
      staleCount: number;
    }
  >();

  const getOrCreateCurrencyEntry = (curr: CurrencyCode) => {
    let entry = totalsByCurrency.get(curr);
    if (!entry) {
      entry = {
        amountMinor: 0n,
        freshCount: 0,
        missingCount: 0,
        staleCount: 0,
      };
      totalsByCurrency.set(curr, entry);
    }
    return entry;
  };

  let freshAccountsCount = 0;

  for (const acc of eligibleAccounts) {
    const cCode =
      typeof acc.currency === "string"
        ? currencyCode(acc.currency)
        : acc.currency;
    const entry = getOrCreateCurrencyEntry(cCode);

    if (!acc.balanceSnapshot) {
      missingAccounts.push(
        Object.freeze({
          id: acc.id,
          name: acc.name,
          currency: cCode,
        }),
      );
      entry.missingCount++;
    } else if (
      isSnapshotStale(acc.balanceSnapshot.capturedAt, asOf, thresholdMs)
    ) {
      staleAccounts.push(
        Object.freeze({
          id: acc.id,
          name: acc.name,
          currency: cCode,
          capturedAt: new Date(acc.balanceSnapshot.capturedAt),
        }),
      );
      entry.staleCount++;
    } else {
      entry.amountMinor += acc.balanceSnapshot.balance.amountMinor;
      entry.freshCount++;
      freshAccountsCount++;
    }
  }

  const byCurrency: CurrencyAvailableCash[] = Array.from(
    totalsByCurrency.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([curr, data]) =>
      Object.freeze({
        currency: curr,
        amountMinor: data.amountMinor,
        freshAccountCount: data.freshCount,
        missingAccountCount: data.missingCount,
        staleAccountCount: data.staleCount,
        isComplete: data.missingCount === 0 && data.staleCount === 0,
      }),
    );

  return Object.freeze({
    byCurrency: Object.freeze(byCurrency),
    missingAccounts: Object.freeze(missingAccounts),
    staleAccounts: Object.freeze(staleAccounts),
    totalEligibleAccounts: eligibleAccounts.length,
    freshAccountsCount,
    isFullyKnown:
      eligibleAccounts.length > 0 &&
      missingAccounts.length === 0 &&
      staleAccounts.length === 0,
  });
}

export type CurrencyCashFlow = Readonly<{
  currency: CurrencyCode;
  incomeMinor: bigint;
  spendingMinor: bigint;
  netCashFlowMinor: bigint;
  transactionCount: number;
}>;

export type PeriodCashFlowSummary = Readonly<{
  byCurrency: readonly CurrencyCashFlow[];
  totalTransactionsCount: number;
}>;

/**
 * Aggregates actual cash flow for a selected period:
 * - Income: sum of non-voided income transactions.
 * - Spending: sum of non-voided expense transactions.
 * - Net cash flow: incomeMinor - spendingMinor (exact bigint).
 * - Internal transfers are excluded.
 * - Voided transactions are excluded.
 * - Preserves credit card purchase vs repayment semantics: credit card purchases
 *   are expenses, card repayments are transfers (and thus excluded from income/spending).
 * - Grouped by currency without combining.
 */
export function aggregatePeriodCashFlow(
  transactions: readonly Transaction[],
  period: Period,
): PeriodCashFlowSummary {
  const relevantTransactions = transactions.filter(
    (tx) =>
      !isVoided(tx) &&
      tx.kind !== "transfer" &&
      isDateInPeriod(tx.occurredOn, period),
  );

  const byCurrencyMap = new Map<
    CurrencyCode,
    {
      incomeMinor: bigint;
      spendingMinor: bigint;
      count: number;
    }
  >();

  for (const tx of relevantTransactions) {
    const curr = tx.amount.currency;
    let entry = byCurrencyMap.get(curr);
    if (!entry) {
      entry = { incomeMinor: 0n, spendingMinor: 0n, count: 0 };
      byCurrencyMap.set(curr, entry);
    }

    entry.count++;
    if (tx.kind === "income") {
      entry.incomeMinor += tx.amount.amountMinor;
    } else if (tx.kind === "expense") {
      entry.spendingMinor += tx.amount.amountMinor;
    }
  }

  const byCurrency: CurrencyCashFlow[] = Array.from(byCurrencyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, data]) =>
      Object.freeze({
        currency,
        incomeMinor: data.incomeMinor,
        spendingMinor: data.spendingMinor,
        netCashFlowMinor: data.incomeMinor - data.spendingMinor,
        transactionCount: data.count,
      }),
    );

  return Object.freeze({
    byCurrency: Object.freeze(byCurrency),
    totalTransactionsCount: relevantTransactions.length,
  });
}

export type CategorySpending = Readonly<{
  categoryId: CategoryId | null;
  currency: CurrencyCode;
  amountMinor: bigint;
  transactionCount: number;
}>;

/**
 * Aggregates spending by category for a period:
 * - Only non-voided expense transactions.
 * - Includes uncategorized transactions (categoryId = null).
 * - Exact bigint arithmetic.
 */
export function aggregatePeriodCategorySpending(
  transactions: readonly Transaction[],
  period: Period,
): readonly CategorySpending[] {
  const expenseTransactions = transactions.filter(
    (tx): tx is ExpenseTransaction =>
      !isVoided(tx) &&
      tx.kind === "expense" &&
      isDateInPeriod(tx.occurredOn, period),
  );

  const groupKey = (catId: string | null, curr: string) => `${curr}:::${catId ?? "null"}`;
  const map = new Map<
    string,
    {
      categoryId: CategoryId | null;
      currency: CurrencyCode;
      amountMinor: bigint;
      transactionCount: number;
    }
  >();

  for (const tx of expenseTransactions) {
    const catId = tx.categoryId ?? null;
    const curr = tx.amount.currency;
    const key = groupKey(catId, curr);

    let entry = map.get(key);
    if (!entry) {
      entry = {
        categoryId: catId,
        currency: curr,
        amountMinor: 0n,
        transactionCount: 0,
      };
      map.set(key, entry);
    }

    entry.amountMinor += tx.amount.amountMinor;
    entry.transactionCount++;
  }

  return Object.freeze(
    Array.from(map.values()).sort((a, b) => {
      // Primary sort: currency, Secondary: amountMinor descending
      if (a.currency !== b.currency) {
        return a.currency.localeCompare(b.currency);
      }
      if (b.amountMinor > a.amountMinor) return 1;
      if (b.amountMinor < a.amountMinor) return -1;
      return 0;
    }),
  );
}
