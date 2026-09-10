import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import { createObligation, generateRecurringDueDates, householdId as toHouseholdId, money } from "@nodvis/finance-domain";
import type { RecurringObligationFrequency } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { households, obligations, recurringObligationDefinitions } from "../schema";

export const RECURRING_MATERIALIZATION_DAYS = 90;

type DefinitionInput = {
  title: string;
  amountMinor: bigint;
  currency: string;
  frequency: RecurringObligationFrequency;
  firstDueDate: string;
  endDate?: string | null;
  notes?: string | null;
};
type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export class RecurringObligationNotFoundError extends Error {}
export class RecurringObligationVersionConflictError extends Error {}

function horizonDate(today: string): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + RECURRING_MATERIALIZATION_DAYS);
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function materializeInTransaction(
  dbTx: DbTransaction,
  definition: typeof recurringObligationDefinitions.$inferSelect,
  through: string,
  from: string,
) {
  const dates = generateRecurringDueDates(
    { frequency: definition.frequency as RecurringObligationFrequency, firstDueDate: definition.firstDueDate, endDate: definition.endDate },
    through,
    from,
  );
  for (const scheduledDate of dates) {
    const [existing] = await dbTx.select().from(obligations).where(and(
      eq(obligations.recurringDefinitionId, definition.id),
      eq(obligations.recurringScheduledDate, scheduledDate),
    )).limit(1);
    if (existing?.transactionId || existing?.recurringSkipped) continue;
    if (existing?.recurringOverride) {
      if (existing.cancelledAt) {
        await dbTx.update(obligations).set({ cancelledAt: null, updatedAt: new Date(), version: sql`${obligations.version} + 1` }).where(eq(obligations.id, existing.id));
      }
      continue;
    }
    const entity = createObligation({
      householdId: toHouseholdId(definition.householdId),
      title: definition.title,
      amount: money(definition.amountMinor, definition.currency),
      dueDate: scheduledDate,
      notes: definition.notes,
    });
    if (existing) {
      await dbTx.update(obligations).set({
        title: entity.title,
        amountMinor: entity.amount.amountMinor,
        currency: entity.amount.currency,
        dueDate: entity.dueDate,
        notes: entity.notes,
        cancelledAt: null,
        recurringOverride: false,
        version: sql`${obligations.version} + 1`,
        updatedAt: new Date(),
      }).where(eq(obligations.id, existing.id));
      continue;
    }
    await dbTx.insert(obligations).values({
      id: entity.id,
      householdId: definition.householdId,
      title: definition.title,
      amountMinor: definition.amountMinor,
      currency: definition.currency,
      dueDate: scheduledDate,
      notes: definition.notes,
      recurringDefinitionId: definition.id,
      recurringScheduledDate: scheduledDate,
      recurringOverride: false,
      recurringSkipped: false,
      transactionId: null,
      version: 1,
      cancelledAt: null,
    }).onConflictDoNothing();
  }
}

export async function createRecurringObligationInDb(householdId: string, input: DefinitionInput, through = horizonDate(today())) {
  return getDb().transaction(async (dbTx) => {
    await dbTx.select({ id: households.id }).from(households).where(eq(households.id, householdId)).for("update");
    const [definition] = await dbTx.insert(recurringObligationDefinitions).values({
      householdId,
      title: input.title.trim(),
      amountMinor: input.amountMinor,
      currency: input.currency.trim().toUpperCase(),
      frequency: input.frequency,
      firstDueDate: input.firstDueDate,
      endDate: input.endDate ?? null,
      notes: input.notes?.trim() || null,
      version: 1,
      cancelledAt: null,
    }).returning();
    if (!definition) throw new Error("Failed to create recurring obligation");
    await materializeInTransaction(dbTx, definition, through, today());
    return definition;
  });
}

export async function listRecurringObligationsInDb(householdId: string) {
  return getDb().select().from(recurringObligationDefinitions)
    .where(eq(recurringObligationDefinitions.householdId, householdId))
    .orderBy(asc(recurringObligationDefinitions.firstDueDate), asc(recurringObligationDefinitions.id));
}

export async function materializeRecurringObligationsInDb(householdId: string, through = horizonDate(today()), from = today()) {
  return getDb().transaction(async (dbTx) => {
    await dbTx.select({ id: households.id }).from(households).where(eq(households.id, householdId)).for("update");
    const definitions = await dbTx.select().from(recurringObligationDefinitions).where(and(eq(recurringObligationDefinitions.householdId, householdId), isNull(recurringObligationDefinitions.cancelledAt)));
    for (const definition of definitions) await materializeInTransaction(dbTx, definition, through, from);
    return definitions;
  });
}

export async function updateRecurringObligationInDb(householdId: string, id: string, version: number, input: Partial<DefinitionInput>) {
  return getDb().transaction(async (dbTx) => {
    await dbTx.select({ id: households.id }).from(households).where(eq(households.id, householdId)).for("update");
    const [definition] = await dbTx.select().from(recurringObligationDefinitions).where(and(eq(recurringObligationDefinitions.householdId, householdId), eq(recurringObligationDefinitions.id, id))).limit(1);
    if (!definition) throw new RecurringObligationNotFoundError("Recurring obligation not found");
    if (definition.version !== version) throw new RecurringObligationVersionConflictError("Recurring obligation version mismatch");
    if (definition.cancelledAt) throw new RecurringObligationVersionConflictError("Cancelled recurring obligation cannot be edited");
    const [updated] = await dbTx.update(recurringObligationDefinitions).set({
      title: input.title?.trim() ?? definition.title,
      amountMinor: input.amountMinor ?? definition.amountMinor,
      currency: input.currency?.trim().toUpperCase() ?? definition.currency,
      frequency: input.frequency ?? definition.frequency,
      firstDueDate: input.firstDueDate ?? definition.firstDueDate,
      endDate: input.endDate === undefined ? definition.endDate : input.endDate,
      notes: input.notes === undefined ? definition.notes : input.notes?.trim() || null,
      version: definition.version + 1,
      updatedAt: new Date(),
    }).where(and(eq(recurringObligationDefinitions.id, id), eq(recurringObligationDefinitions.version, version))).returning();
    if (!updated) throw new RecurringObligationVersionConflictError("Recurring obligation version mismatch");
    await dbTx.update(obligations).set({
      cancelledAt: new Date(), updatedAt: new Date(), version: sql`${obligations.version} + 1`,
    }).where(and(eq(obligations.recurringDefinitionId, id), isNull(obligations.transactionId), isNull(obligations.cancelledAt), gte(obligations.dueDate, today())));
    await materializeInTransaction(dbTx, updated, horizonDate(today()), today());
    return updated;
  });
}

export async function cancelRecurringObligationInDb(householdId: string, id: string, version: number) {
  return getDb().transaction(async (dbTx) => {
    await dbTx.select({ id: households.id }).from(households).where(eq(households.id, householdId)).for("update");
    const [updated] = await dbTx.update(recurringObligationDefinitions).set({ cancelledAt: new Date(), version: sql`${recurringObligationDefinitions.version} + 1`, updatedAt: new Date() }).where(and(eq(recurringObligationDefinitions.householdId, householdId), eq(recurringObligationDefinitions.id, id), eq(recurringObligationDefinitions.version, version), isNull(recurringObligationDefinitions.cancelledAt))).returning();
    if (!updated) throw new RecurringObligationVersionConflictError("Recurring obligation is missing, cancelled, or stale");
    await dbTx.update(obligations).set({ cancelledAt: new Date(), updatedAt: new Date(), version: sql`${obligations.version} + 1` }).where(and(eq(obligations.recurringDefinitionId, id), isNull(obligations.transactionId), isNull(obligations.cancelledAt), gte(obligations.dueDate, today())));
    return updated;
  });
}
