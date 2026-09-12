import type { AccountType } from "./account";
import type { CurrencyCode, Money } from "./money";
import { currencyCode } from "./money";

export type NetWorthAccountObservation = Readonly<{
  type: AccountType;
  balance: Money;
}>;

export type NetWorthCurrencySummary = Readonly<{
  currency: CurrencyCode;
  assetsMinor: bigint;
  liabilitiesMinor: bigint;
  netWorthMinor: bigint;
}>;

export type NetWorthSummary = Readonly<{
  byCurrency: readonly NetWorthCurrencySummary[];
}>;

export type NetWorthConfidence = "complete" | "incomplete" | "no_data";

export type HistoricalSeriesSubject = Readonly<{
  id: string;
  name: string;
  kind: "account" | "liability";
  accountType?: AccountType;
  currency: CurrencyCode | string;
  archivedAt?: Date | null;
}>;

export type HistoricalSeriesObservation = Readonly<{
  id: string;
  subjectId: string;
  subjectKind: "account" | "liability";
  amountMinor: bigint;
  currency: CurrencyCode | string;
  observedAt: Date;
  createdAt?: Date;
  source?: string;
  note?: string | null;
}>;

export type HistoricalNetWorthPoint = Readonly<{
  date: string;
  timestamp: Date;
  currency: CurrencyCode;
  assetsMinor: bigint;
  liabilitiesMinor: bigint;
  netWorthMinor: bigint;
  confidence: NetWorthConfidence;
  isComplete: boolean;
  observedSubjectCount: number;
  totalSubjectCount: number;
  missingSubjectNames: readonly string[];
}>;

export type HistoricalSeriesByCurrency = Readonly<{
  currency: CurrencyCode;
  points: readonly HistoricalNetWorthPoint[];
  currentNetWorthMinor: bigint;
  currentAssetsMinor: bigint;
  currentLiabilitiesMinor: bigint;
  currentConfidence: NetWorthConfidence;
  currentIsComplete: boolean;
  missingSubjectNames: readonly string[];
  latestObservedAt: Date | null;
}>;

export type NetWorthHistorySummary = Readonly<{
  byCurrency: readonly HistoricalSeriesByCurrency[];
}>;

/**
 * Calculates financial position from point-in-time observations.
 *
 * Asset account balances are assets when positive and liabilities when
 * negative. Credit-card balances use the domain sign convention: negative is
 * debt, positive is an overpayment asset. Explicit liabilities are added to
 * the same currency bucket. No currencies are exchanged or combined.
 */
export function calculateNetWorth(input: {
  accounts: readonly NetWorthAccountObservation[];
  liabilities: readonly Money[];
}): NetWorthSummary {
  const buckets = new Map<CurrencyCode, { assetsMinor: bigint; liabilitiesMinor: bigint }>();

  const bucketFor = (rawCurrency: CurrencyCode | string) => {
    const currency = typeof rawCurrency === "string" ? currencyCode(rawCurrency) : rawCurrency;
    let bucket = buckets.get(currency);
    if (!bucket) {
      bucket = { assetsMinor: 0n, liabilitiesMinor: 0n };
      buckets.set(currency, bucket);
    }
    return bucket;
  };

  for (const observation of input.accounts) {
    const bucket = bucketFor(observation.balance.currency);
    const amount = observation.balance.amountMinor;

    if (observation.type === "credit_card") {
      if (amount < 0n) bucket.liabilitiesMinor += -amount;
      else bucket.assetsMinor += amount;
    } else if (amount < 0n) {
      bucket.liabilitiesMinor += -amount;
    } else {
      bucket.assetsMinor += amount;
    }
  }

  for (const liability of input.liabilities) {
    if (liability.amountMinor < 0n) {
      throw new Error("Net worth liabilities must be non-negative");
    }
    bucketFor(liability.currency).liabilitiesMinor += liability.amountMinor;
  }

  return Object.freeze({
    byCurrency: Object.freeze(
      Array.from(buckets.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([currency, values]) =>
          Object.freeze({
            currency,
            assetsMinor: values.assetsMinor,
            liabilitiesMinor: values.liabilitiesMinor,
            netWorthMinor: values.assetsMinor - values.liabilitiesMinor,
          }),
        ),
    ),
  });
}

/**
 * Builds a chronological historical series of Net Worth per currency using persisted observations.
 *
 * Honors explicit incomplete-history confidence:
 * If an active account or liability has no observation recorded on or before a given evaluation date,
 * the point is marked as incomplete (`confidence: "incomplete"`, `isComplete: false`) and lists the
 * missing subject names, rather than fabricating balances or assuming zero debt/cash.
 *
 * Strictly separates currencies with no foreign exchange conversion.
 */
export function calculateHistoricalNetWorthSeries(input: {
  subjects: readonly HistoricalSeriesSubject[];
  observations: readonly HistoricalSeriesObservation[];
  asOf?: Date;
  dates?: readonly string[];
}): NetWorthHistorySummary {
  const asOf = input.asOf ?? new Date();
  const asOfDateStr = asOf.toISOString().slice(0, 10);

  const isLaterObservation = (
    candidate: HistoricalSeriesObservation,
    current: HistoricalSeriesObservation,
  ): boolean => {
    const observedDelta = candidate.observedAt.getTime() - current.observedAt.getTime();
    if (observedDelta !== 0) return observedDelta > 0;
    const createdDelta =
      (candidate.createdAt?.getTime() ?? candidate.observedAt.getTime()) -
      (current.createdAt?.getTime() ?? current.observedAt.getTime());
    if (createdDelta !== 0) return createdDelta > 0;
    return candidate.id > current.id;
  };

  // Filter to active subjects
  const activeSubjects = input.subjects.filter((s) => s.archivedAt === null || s.archivedAt === undefined);

  // Group subjects by currency
  const subjectsByCurrency = new Map<CurrencyCode, HistoricalSeriesSubject[]>();
  for (const subject of activeSubjects) {
    const curr = typeof subject.currency === "string" ? currencyCode(subject.currency) : subject.currency;
    const list = subjectsByCurrency.get(curr) ?? [];
    list.push(subject);
    subjectsByCurrency.set(curr, list);
  }

  // Also include currencies from observations even if all subjects were archived
  const allCurrencies = new Set<CurrencyCode>(subjectsByCurrency.keys());
  for (const obs of input.observations) {
    const curr = typeof obs.currency === "string" ? currencyCode(obs.currency) : obs.currency;
    allCurrencies.add(curr);
  }

  // Determine chronological evaluation dates
  let evalDates: string[];
  if (input.dates && input.dates.length > 0) {
    evalDates = Array.from(new Set(input.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
  } else {
    const dateSet = new Set<string>();
    for (const obs of input.observations) {
      const dStr = obs.observedAt.toISOString().slice(0, 10);
      if (dStr <= asOfDateStr) {
        dateSet.add(dStr);
      }
    }
    dateSet.add(asOfDateStr);
    evalDates = Array.from(dateSet).sort();
  }

  if (evalDates.length === 0) {
    evalDates = [asOfDateStr];
  }

  const sortedCurrencies = Array.from(allCurrencies).sort();
  const seriesByCurrency: HistoricalSeriesByCurrency[] = [];

  for (const curr of sortedCurrencies) {
    const subjects = subjectsByCurrency.get(curr) ?? [];
    const observations = input.observations.filter((obs) => {
      const obsCurr = typeof obs.currency === "string" ? currencyCode(obs.currency) : obs.currency;
      return obsCurr === curr;
    });

    let latestObsDate: Date | null = null;
    for (const obs of observations) {
      if (!latestObsDate || obs.observedAt.getTime() > latestObsDate.getTime()) {
        latestObsDate = obs.observedAt;
      }
    }

    const points: HistoricalNetWorthPoint[] = [];

    for (const dateStr of evalDates) {
      const endOfDate = new Date(`${dateStr}T23:59:59.999Z`);
      let assetsMinor = 0n;
      let liabilitiesMinor = 0n;
      const missingSubjectNames: string[] = [];
      let observedCount = 0;

      for (const subject of subjects) {
        // Find latest observation on or before endOfDate
        let latestObs: HistoricalSeriesObservation | null = null;
        for (const obs of observations) {
          if (obs.subjectId === subject.id && obs.observedAt.getTime() <= endOfDate.getTime()) {
            if (!latestObs || isLaterObservation(obs, latestObs)) {
              latestObs = obs;
            }
          }
        }

        if (latestObs) {
          observedCount++;
          const amount = latestObs.amountMinor;
          if (subject.kind === "account") {
            if (subject.accountType === "credit_card") {
              if (amount < 0n) liabilitiesMinor += -amount;
              else assetsMinor += amount;
            } else if (amount < 0n) {
              liabilitiesMinor += -amount;
            } else {
              assetsMinor += amount;
            }
          } else {
            // liability
            if (amount < 0n) {
              throw new Error(`Net worth liability observation for ${subject.name} must be non-negative`);
            }
            liabilitiesMinor += amount;
          }
        } else {
          missingSubjectNames.push(subject.name);
        }
      }

      let confidence: NetWorthConfidence;
      let isComplete: boolean;

      if (subjects.length === 0) {
        confidence = "no_data";
        isComplete = false;
      } else if (observedCount === subjects.length) {
        confidence = "complete";
        isComplete = true;
      } else if (observedCount > 0) {
        confidence = "incomplete";
        isComplete = false;
      } else {
        confidence = "no_data";
        isComplete = false;
      }

      points.push(
        Object.freeze({
          date: dateStr,
          timestamp: endOfDate,
          currency: curr,
          assetsMinor,
          liabilitiesMinor,
          netWorthMinor: assetsMinor - liabilitiesMinor,
          confidence,
          isComplete,
          observedSubjectCount: observedCount,
          totalSubjectCount: subjects.length,
          missingSubjectNames: Object.freeze(missingSubjectNames),
        }),
      );
    }

    const lastPoint = points.at(-1);
    seriesByCurrency.push(
      Object.freeze({
        currency: curr,
        points: Object.freeze(points),
        currentNetWorthMinor: lastPoint?.netWorthMinor ?? 0n,
        currentAssetsMinor: lastPoint?.assetsMinor ?? 0n,
        currentLiabilitiesMinor: lastPoint?.liabilitiesMinor ?? 0n,
        currentConfidence: lastPoint?.confidence ?? "no_data",
        currentIsComplete: lastPoint?.isComplete ?? false,
        missingSubjectNames: lastPoint?.missingSubjectNames ?? Object.freeze([]),
        latestObservedAt: latestObsDate,
      }),
    );
  }

  return Object.freeze({
    byCurrency: Object.freeze(seriesByCurrency),
  });
}
