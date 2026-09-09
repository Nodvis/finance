export type RecurringObservationKind = "expense" | "income";

export type RecurringObservation = {
  id: string;
  kind: RecurringObservationKind;
  counterparty: string;
  amountMinor: bigint;
  currency: string;
  occurredOn: Date;
};

export type RecurringPattern = {
  key: string;
  kind: RecurringObservationKind;
  counterparty: string;
  currency: string;
  frequency: "weekly" | "monthly";
  observationIds: string[];
  firstObservedOn: Date;
  lastObservedOn: Date;
  nextExpectedOn: Date;
  typicalAmountMinor: bigint;
  minAmountMinor: bigint;
  maxAmountMinor: bigint;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeRecurringCounterparty(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function median(values: bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)]!;
}

function classifyIntervals(dates: Date[]): "weekly" | "monthly" | null {
  const intervals = dates.slice(1).map((date, index) =>
    Math.round((date.getTime() - dates[index]!.getTime()) / DAY_MS),
  );
  const weekly = intervals.every((days) => days >= 6 && days <= 8);
  const monthly = intervals.every((days) => days >= 25 && days <= 35);
  return weekly ? "weekly" : monthly ? "monthly" : null;
}

export function detectRecurringPatterns(
  observations: readonly RecurringObservation[],
): RecurringPattern[] {
  const groups = new Map<string, RecurringObservation[]>();
  for (const observation of observations) {
    const counterparty = normalizeRecurringCounterparty(observation.counterparty);
    if (!counterparty || observation.amountMinor <= 0n) continue;
    const key = `${observation.kind}:${observation.currency}:${counterparty}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const patterns: RecurringPattern[] = [];
  for (const [key, group] of groups) {
    const ordered = [...group].sort(
      (a, b) => a.occurredOn.getTime() - b.occurredOn.getTime(),
    );
    if (ordered.length < 3) continue;

    const frequency = classifyIntervals(ordered.map((item) => item.occurredOn));
    if (!frequency) continue;

    const amounts = ordered.map((item) => item.amountMinor);
    const minAmountMinor = amounts.reduce((min, amount) => (amount < min ? amount : min));
    const maxAmountMinor = amounts.reduce((max, amount) => (amount > max ? amount : max));
    if (maxAmountMinor - minAmountMinor > maxAmountMinor / 10n) continue;

    const lastObservedOn = ordered.at(-1)!.occurredOn;
    const nextExpectedOn = new Date(lastObservedOn);
    nextExpectedOn.setUTCDate(nextExpectedOn.getUTCDate() + (frequency === "weekly" ? 7 : 30));

    patterns.push({
      key,
      kind: ordered[0]!.kind,
      counterparty: ordered[0]!.counterparty.trim().replace(/\s+/g, " "),
      currency: ordered[0]!.currency,
      frequency,
      observationIds: ordered.map((item) => item.id),
      firstObservedOn: ordered[0]!.occurredOn,
      lastObservedOn,
      nextExpectedOn,
      typicalAmountMinor: median(amounts),
      minAmountMinor,
      maxAmountMinor,
    });
  }

  return patterns.sort((a, b) => a.counterparty.localeCompare(b.counterparty));
}
