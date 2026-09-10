import { currencyCode, type CurrencyCode } from "./money";

export type ForecastCashInput = Readonly<{
  currency: CurrencyCode | string;
  amountMinor: bigint;
  isComplete: boolean;
}>;

export type ForecastObligationInput = Readonly<{
  currency: CurrencyCode | string;
  amountMinor: bigint;
  dueDate: string;
  status: "upcoming" | "overdue" | "paid" | "cancelled";
}>;

export type CashForecastCurrency = Readonly<{
  currency: CurrencyCode;
  availableCashMinor: bigint;
  includedObligationsMinor: bigint;
  includedObligationCount: number;
  projectedCashMinor: bigint;
  isComplete: boolean;
  status: "positive" | "zero" | "deficit" | "incomplete";
}>;

export type CashForecast = Readonly<{
  asOf: string;
  horizonDays: 7 | 30;
  endDate: string;
  byCurrency: readonly CashForecastCurrency[];
}>;

export function calculateCashForecast(input: {
  asOf: string;
  horizonDays: 7 | 30;
  availableCash: readonly ForecastCashInput[];
  obligations: readonly ForecastObligationInput[];
}): CashForecast {
  const start = parseDate(input.asOf);
  const endDate = new Date(start.getTime());
  endDate.setUTCDate(endDate.getUTCDate() + input.horizonDays);
  const end = toDateString(endDate);
  const cashByCurrency = new Map<CurrencyCode, { amountMinor: bigint; isComplete: boolean }>();

  for (const cash of input.availableCash) {
    const currency = currencyCode(cash.currency);
    const existing = cashByCurrency.get(currency);
    cashByCurrency.set(currency, {
      amountMinor: (existing?.amountMinor ?? 0n) + cash.amountMinor,
      isComplete: (existing?.isComplete ?? true) && cash.isComplete,
    });
  }

  const obligationsByCurrency = new Map<CurrencyCode, { amountMinor: bigint; count: number }>();
  for (const obligation of input.obligations) {
    if (obligation.status === "paid" || obligation.status === "cancelled") continue;
    parseDate(obligation.dueDate);
    if (obligation.dueDate < input.asOf || obligation.dueDate > end) continue;
    const currency = currencyCode(obligation.currency);
    const existing = obligationsByCurrency.get(currency);
    obligationsByCurrency.set(currency, {
      amountMinor: (existing?.amountMinor ?? 0n) + obligation.amountMinor,
      count: (existing?.count ?? 0) + 1,
    });
  }

  const currencies = new Set([...cashByCurrency.keys(), ...obligationsByCurrency.keys()]);
  const byCurrency = [...currencies].sort().map((currency) => {
    const cash = cashByCurrency.get(currency) ?? { amountMinor: 0n, isComplete: false };
    const obligations = obligationsByCurrency.get(currency) ?? { amountMinor: 0n, count: 0 };
    const projected = cash.amountMinor - obligations.amountMinor;
    return Object.freeze({
      currency,
      availableCashMinor: cash.amountMinor,
      includedObligationsMinor: obligations.amountMinor,
      includedObligationCount: obligations.count,
      projectedCashMinor: projected,
      isComplete: cash.isComplete,
      status: !cash.isComplete ? "incomplete" : projected < 0n ? "deficit" : projected === 0n ? "zero" : "positive",
    });
  });

  return Object.freeze({ asOf: input.asOf, horizonDays: input.horizonDays, endDate: end, byCurrency: Object.freeze(byCurrency) });
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid forecast date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid forecast date: ${value}`);
  }
  return date;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
