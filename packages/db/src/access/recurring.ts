import { and, asc, eq, isNull, isNotNull, or } from "drizzle-orm";

import type { RecurringPattern } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { recurringPatterns, transactions } from "../schema";

export type RecurringObservationRow = {
  id: string;
  kind: "expense" | "income";
  counterparty: string;
  amountMinor: bigint;
  currency: string;
  occurredOn: Date;
};

export type RecurringPatternStatus = "suggested" | "confirmed" | "dismissed";

export async function listRecurringObservations(
  householdId: string,
): Promise<RecurringObservationRow[]> {
  const rows = await getDb()
    .select({
      id: transactions.id,
      kind: transactions.kind,
      payee: transactions.payee,
      source: transactions.source,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      occurredOn: transactions.occurredOn,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        isNull(transactions.voidedAt),
        or(eq(transactions.kind, "expense"), eq(transactions.kind, "income")),
        or(isNotNull(transactions.payee), isNotNull(transactions.source)),
      ),
    )
    .orderBy(asc(transactions.occurredOn));

  return rows.flatMap((row) => {
    if (row.kind !== "expense" && row.kind !== "income") return [];
    const counterparty = row.kind === "expense" ? row.payee : row.source;
    return counterparty
      ? [{
          id: row.id,
          kind: row.kind,
          counterparty,
          amountMinor: row.amountMinor,
          currency: row.currency,
          occurredOn: row.occurredOn,
        }]
      : [];
  });
}

export async function listSavedRecurringPatterns(householdId: string) {
  return await getDb()
    .select()
    .from(recurringPatterns)
    .where(eq(recurringPatterns.householdId, householdId));
}

export async function saveRecurringPatternStatus(
  householdId: string,
  pattern: RecurringPattern,
  status: RecurringPatternStatus,
) {
  const [row] = await getDb()
    .insert(recurringPatterns)
    .values({
      householdId,
      patternKey: pattern.key,
      kind: pattern.kind,
      counterparty: pattern.counterparty,
      currency: pattern.currency,
      frequency: pattern.frequency,
      typicalAmountMinor: pattern.typicalAmountMinor,
      minAmountMinor: pattern.minAmountMinor,
      maxAmountMinor: pattern.maxAmountMinor,
      firstObservedOn: pattern.firstObservedOn,
      lastObservedOn: pattern.lastObservedOn,
      nextExpectedOn: pattern.nextExpectedOn,
      observationCount: pattern.observationIds.length,
      status,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [recurringPatterns.householdId, recurringPatterns.patternKey],
      set: {
        typicalAmountMinor: pattern.typicalAmountMinor,
        minAmountMinor: pattern.minAmountMinor,
        maxAmountMinor: pattern.maxAmountMinor,
        firstObservedOn: pattern.firstObservedOn,
        lastObservedOn: pattern.lastObservedOn,
        nextExpectedOn: pattern.nextExpectedOn,
        observationCount: pattern.observationIds.length,
        status,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
