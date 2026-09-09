import "server-only";

import {
  detectRecurringPatterns,
} from "@nodvis/finance-domain";
import type { RecurringPattern } from "@nodvis/finance-domain";
import {
  listRecurringObservations,
  listSavedRecurringPatterns,
  saveRecurringPatternStatus,
} from "@nodvis/finance-db";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type { AuthorizedHouseholdContext } from "@/lib/transactions/service";

type HouseholdContext = AuthorizedHouseholdUserContext | AuthorizedHouseholdContext;

export type SerializedRecurringPattern = {
  key: string;
  kind: "expense" | "income";
  counterparty: string;
  currency: string;
  frequency: "weekly" | "monthly";
  observationIds: string[];
  firstObservedOn: string;
  lastObservedOn: string;
  nextExpectedOn: string;
  typicalAmountMinor: string;
  minAmountMinor: string;
  maxAmountMinor: string;
  status: "suggested" | "confirmed" | "dismissed";
};

function serialize(
  pattern: RecurringPattern,
  status: "suggested" | "confirmed" | "dismissed",
): SerializedRecurringPattern {
  return {
    key: pattern.key,
    kind: pattern.kind,
    counterparty: pattern.counterparty,
    currency: pattern.currency,
    frequency: pattern.frequency,
    observationIds: pattern.observationIds,
    firstObservedOn: pattern.firstObservedOn.toISOString(),
    lastObservedOn: pattern.lastObservedOn.toISOString(),
    nextExpectedOn: pattern.nextExpectedOn.toISOString(),
    typicalAmountMinor: pattern.typicalAmountMinor.toString(),
    minAmountMinor: pattern.minAmountMinor.toString(),
    maxAmountMinor: pattern.maxAmountMinor.toString(),
    status,
  };
}

export async function listHouseholdRecurringPatterns(
  context: HouseholdContext,
): Promise<SerializedRecurringPattern[]> {
  const [observations, saved] = await Promise.all([
    listRecurringObservations(context.householdId),
    listSavedRecurringPatterns(context.householdId),
  ]);
  const detected = detectRecurringPatterns(observations);
  const statuses = new Map(saved.map((row) => [row.patternKey, row.status]));
  return detected.map((pattern) =>
    serialize(pattern, statuses.get(pattern.key) ?? "suggested"),
  );
}

export async function updateHouseholdRecurringPattern(
  context: HouseholdContext,
  patternKey: string,
  status: "confirmed" | "dismissed",
): Promise<SerializedRecurringPattern> {
  const observations = await listRecurringObservations(context.householdId);
  const pattern = detectRecurringPatterns(observations).find(
    (candidate) => candidate.key === patternKey,
  );
  if (!pattern) throw new Error("Recurring pattern is no longer supported by current data");
  await saveRecurringPatternStatus(context.householdId, pattern, status);
  return serialize(pattern, status);
}
