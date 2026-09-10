import type {
  HouseholdId,
  ObligationId,
  TransactionId,
} from "./identity";
import { obligationId } from "./identity";
import type { CurrencyCode, Money } from "./money";
import { currencyCode } from "./money";
import type { Transaction } from "./transaction";

export const MAX_OBLIGATION_TITLE_LENGTH = 160;
export const MAX_OBLIGATION_NOTES_LENGTH = 280;

const CALENDAR_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

export function validateCalendarDate(dateStr: string): string {
  if (!CALENDAR_DATE_REGEX.test(dateStr)) {
    throw new Error(`Invalid calendar date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number.parseInt(yearStr!, 10);
  const month = Number.parseInt(monthStr!, 10);
  const day = Number.parseInt(dayStr!, 10);

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }
  return dateStr;
}

export function validateObligationTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Title cannot be blank");
  }
  if (trimmed.length > MAX_OBLIGATION_TITLE_LENGTH) {
    throw new Error(
      `Title exceeds maximum length of ${MAX_OBLIGATION_TITLE_LENGTH} characters`,
    );
  }
  return trimmed;
}

export function validateObligationNotes(raw?: string | null): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_OBLIGATION_NOTES_LENGTH) {
    throw new Error(
      `Notes exceed maximum length of ${MAX_OBLIGATION_NOTES_LENGTH} characters`,
    );
  }
  return trimmed;
}

export function validateObligationAmount(amount: Money): Money {
  if (amount.amountMinor <= 0n) {
    throw new Error("Amount must be positive");
  }
  return amount;
}

export type ObligationStatus = "upcoming" | "overdue" | "paid" | "cancelled";

export type Obligation = Readonly<{
  id: ObligationId;
  householdId: HouseholdId;
  title: string;
  amount: Money;
  dueDate: string; // YYYY-MM-DD
  notes: string | null;
  transactionId: TransactionId | null;
  version: number;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateObligationInput = Readonly<{
  id?: ObligationId | undefined;
  householdId: HouseholdId;
  title: string;
  amount: Money;
  dueDate: string;
  notes?: string | null | undefined;
  transactionId?: TransactionId | null | undefined;
  version?: number | undefined;
  cancelledAt?: Date | null | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}>;

export type UpdateObligationInput = Readonly<{
  title?: string | undefined;
  amount?: Money | undefined;
  dueDate?: string | undefined;
  notes?: string | null | undefined;
}>;

export function getObligationStatus(
  obligation: {
    dueDate: string;
    transactionId: TransactionId | null;
    cancelledAt: Date | null;
  },
  todayDateStr: string = new Date().toISOString().slice(0, 10),
): ObligationStatus {
  if (obligation.cancelledAt !== null) {
    return "cancelled";
  }
  if (obligation.transactionId !== null) {
    return "paid";
  }
  return obligation.dueDate < todayDateStr ? "overdue" : "upcoming";
}

export function createObligation(input: CreateObligationInput): Obligation {
  const id = input.id ?? obligationId(crypto.randomUUID());
  const title = validateObligationTitle(input.title);
  const amount = validateObligationAmount(input.amount);
  const dueDate = validateCalendarDate(input.dueDate);
  const notes = validateObligationNotes(input.notes);
  const now = new Date();

  return Object.freeze({
    id,
    householdId: input.householdId,
    title,
    amount,
    dueDate,
    notes,
    transactionId: input.transactionId ?? null,
    version: input.version ?? 1,
    cancelledAt: input.cancelledAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}

export function updateObligation(
  existing: Obligation,
  input: UpdateObligationInput,
): Obligation {
  if (existing.cancelledAt !== null) {
    throw new Error("Cannot update cancelled obligation");
  }

  const title = input.title !== undefined ? validateObligationTitle(input.title) : existing.title;
  const dueDate = input.dueDate !== undefined ? validateCalendarDate(input.dueDate) : existing.dueDate;
  const notes = input.notes !== undefined ? validateObligationNotes(input.notes) : existing.notes;

  let amount = existing.amount;
  if (input.amount !== undefined) {
    if (
      existing.transactionId !== null &&
      (input.amount.amountMinor !== existing.amount.amountMinor ||
        input.amount.currency !== existing.amount.currency)
    ) {
      throw new Error("Cannot modify amount or currency of matched obligation");
    }
    amount = validateObligationAmount(input.amount);
  }

  return Object.freeze({
    ...existing,
    title,
    dueDate,
    notes,
    amount,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function cancelObligation(
  existing: Obligation,
  cancelledAt: Date = new Date(),
): Obligation {
  if (existing.cancelledAt !== null) {
    throw new Error("Obligation is already cancelled");
  }
  if (existing.transactionId !== null) {
    throw new Error("Cannot cancel a matched obligation; must unlink first");
  }

  return Object.freeze({
    ...existing,
    cancelledAt,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function matchObligation(
  obligation: Obligation,
  transaction: Transaction,
): Obligation {
  if (obligation.cancelledAt !== null) {
    throw new Error("Cannot match cancelled obligation");
  }
  if (obligation.transactionId !== null) {
    throw new Error("Obligation is already matched to a transaction");
  }
  if (obligation.householdId !== transaction.householdId) {
    throw new Error("Matching requires transaction in the same household");
  }
  if (transaction.voidedAt !== null) {
    throw new Error("Matching requires an active transaction");
  }
  if (transaction.kind !== "expense") {
    throw new Error("Matching requires transaction of kind expense only");
  }
  if (obligation.amount.currency !== transaction.amount.currency) {
    throw new Error("Matching requires exact currency match");
  }
  if (obligation.amount.amountMinor !== transaction.amount.amountMinor) {
    throw new Error("Matching requires exact amount match");
  }

  return Object.freeze({
    ...obligation,
    transactionId: transaction.id,
    version: obligation.version + 1,
    updatedAt: new Date(),
  });
}

export function unlinkObligation(
  obligation: Obligation,
  transaction: Transaction,
): Obligation {
  if (obligation.cancelledAt !== null) {
    throw new Error("Cannot unlink cancelled obligation");
  }
  if (obligation.transactionId === null) {
    throw new Error("Obligation is not matched to any transaction");
  }
  if (obligation.transactionId !== transaction.id) {
    throw new Error("Linked transaction id mismatch");
  }

  return Object.freeze({
    ...obligation,
    transactionId: null,
    version: obligation.version + 1,
    updatedAt: new Date(),
  });
}
