import "server-only";

import {
  cancelRecurringObligationInDb,
  createRecurringObligationInDb,
  listRecurringObligationsInDb,
  materializeRecurringObligationsInDb,
  RecurringObligationNotFoundError,
  RecurringObligationVersionConflictError,
  updateRecurringObligationInDb,
} from "@nodvis/finance-db";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";
import { isPersonInHousehold } from "@nodvis/finance-db";
import type { CreateRecurringObligationInput, UpdateRecurringObligationInput } from "./schema";

export type AuthorizedRecurringContext = { householdId: string; personId: string };
export type SerializedRecurringObligation = {
  id: string; householdId: string; title: string; amountMinor: string; currency: string;
  frequency: "weekly" | "monthly" | "yearly"; firstDueDate: string; endDate: string | null;
  notes: string | null; version: number; cancelledAt: string | null; createdAt: string; updatedAt: string;
};

export { RecurringObligationNotFoundError, RecurringObligationVersionConflictError };

async function assertAccess(context: AuthorizedRecurringContext) {
  if (!(await isPersonInHousehold(context.householdId, context.personId))) throw new Error("Household access denied");
}
function serialize(row: Awaited<ReturnType<typeof listRecurringObligationsInDb>>[number]): SerializedRecurringObligation {
  return { ...row, frequency: row.frequency as SerializedRecurringObligation["frequency"], amountMinor: row.amountMinor.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), cancelledAt: row.cancelledAt?.toISOString() ?? null };
}
function amount(input: { amountMinor?: string | undefined; amountNatural?: string | undefined; currency: string }): bigint {
  if (input.amountMinor) return BigInt(input.amountMinor);
  const parsed = parseNaturalDecimalToMinor(input.amountNatural ?? "", input.currency);
  if (!parsed.success || !parsed.amountMinor) throw new Error("Invalid amount format");
  return BigInt(parsed.amountMinor);
}

export async function listHouseholdRecurringObligations(context: AuthorizedRecurringContext) {
  await assertAccess(context);
  await materializeRecurringObligationsInDb(context.householdId);
  return (await listRecurringObligationsInDb(context.householdId)).map(serialize);
}
export async function createHouseholdRecurringObligation(context: AuthorizedRecurringContext, input: CreateRecurringObligationInput) {
  await assertAccess(context);
  return serialize(await createRecurringObligationInDb(context.householdId, {
    title: input.title,
    amountMinor: amount(input),
    currency: input.currency,
    frequency: input.frequency,
    firstDueDate: input.firstDueDate,
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  }));
}
export async function updateHouseholdRecurringObligation(context: AuthorizedRecurringContext, id: string, input: UpdateRecurringObligationInput) {
  await assertAccess(context);
  const { version, amountMinor, amountNatural, ...rest } = input;
  const existing = (await listRecurringObligationsInDb(context.householdId)).find((item) => item.id === id);
  if (!existing) throw new RecurringObligationNotFoundError("Recurring obligation not found");
  const changes: Parameters<typeof updateRecurringObligationInDb>[3] = {};
  if (rest.title !== undefined) changes.title = rest.title;
  if (rest.currency !== undefined) changes.currency = rest.currency;
  if (rest.frequency !== undefined) changes.frequency = rest.frequency;
  if (rest.firstDueDate !== undefined) changes.firstDueDate = rest.firstDueDate;
  if (rest.endDate !== undefined) changes.endDate = rest.endDate;
  if (rest.notes !== undefined) changes.notes = rest.notes;
  if (amountMinor !== undefined || amountNatural !== undefined) changes.amountMinor = amount({ amountMinor, amountNatural, currency: input.currency ?? existing.currency });
  return serialize(await updateRecurringObligationInDb(context.householdId, id, version, changes));
}
export async function cancelHouseholdRecurringObligation(context: AuthorizedRecurringContext, id: string, version: number) {
  await assertAccess(context);
  return serialize(await cancelRecurringObligationInDb(context.householdId, id, version));
}
