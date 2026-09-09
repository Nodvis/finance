import type {
  AccountId,
  HouseholdId,
  LiabilityId,
  LiabilityRepaymentId,
  PersonId,
  TransactionId,
} from "./identity";
import type { CurrencyCode, Money } from "./money";
import { currencyCode, money } from "./money";

export const LIABILITY_KINDS = [
  "loan",
  "mortgage",
  "installment",
  "credit_line",
  "other",
] as const;
export type LiabilityKind = (typeof LIABILITY_KINDS)[number];

// Alias for convenience across schemas
export const LIABILITY_TYPES = LIABILITY_KINDS;
export type LiabilityType = LiabilityKind;

export const REPAYMENT_ALLOCATION_STATES = [
  "unknown",
  "partial",
  "full",
] as const;
export type RepaymentAllocationState =
  (typeof REPAYMENT_ALLOCATION_STATES)[number];

export type Liability = Readonly<{
  id: LiabilityId;
  householdId: HouseholdId;
  name: string;
  kind: LiabilityKind;
  currency: CurrencyCode;
  observedOutstanding: Money | null;
  observedOutstandingAt: Date | null;
  responsiblePersonId: PersonId | null;
  lender: string | null;
  destinationAccountId: AccountId | null;
  notes: string | null;
  version: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateLiabilityInput = Readonly<{
  id: LiabilityId;
  householdId: HouseholdId;
  name: string;
  kind?: LiabilityKind;
  currency: string;
  observedOutstanding?: Money | null;
  observedOutstandingAt?: Date | null;
  responsiblePersonId?: PersonId | null;
  lender?: string | null;
  destinationAccountId?: AccountId | null;
  notes?: string | null;
  version?: number;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}>;

export type UpdateLiabilityInput = Readonly<{
  name?: string;
  kind?: LiabilityKind;
  observedOutstanding?: Money | null;
  observedOutstandingAt?: Date | null;
  responsiblePersonId?: PersonId | null;
  lender?: string | null;
  destinationAccountId?: AccountId | null;
  notes?: string | null;
}>;

export type LiabilityRepayment = Readonly<{
  id: LiabilityRepaymentId;
  householdId: HouseholdId;
  liabilityId: LiabilityId;
  transactionId: TransactionId | null;
  paidAt: Date;
  amount: Money;
  principalAmount: Money | null;
  interestAmount: Money | null;
  feeAmount: Money | null;
  allocationState: RepaymentAllocationState;
  notes: string | null;
  version: number;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateLiabilityRepaymentInput = Readonly<{
  id: LiabilityRepaymentId;
  householdId: HouseholdId;
  liabilityId: LiabilityId;
  transactionId?: TransactionId | null;
  paidAt: Date;
  amount: Money;
  principalAmount?: Money | null;
  interestAmount?: Money | null;
  feeAmount?: Money | null;
  notes?: string | null;
  version?: number;
  voidedAt?: Date | null;
  voidReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}>;

const MAX_NAME_LENGTH = 160;
const MAX_LENDER_LENGTH = 160;
const MAX_NOTES_LENGTH = 280;
const MAX_VOID_REASON_LENGTH = 280;

export function isLiabilityKind(value: string): value is LiabilityKind {
  return (LIABILITY_KINDS as readonly string[]).includes(value as LiabilityKind);
}

export function isLiabilityType(value: string): value is LiabilityType {
  return isLiabilityKind(value);
}

export function validateLiabilityName(rawName: string): string {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    throw new Error("Liability name cannot be blank");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Liability name exceeds maximum length of ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

export function validateLender(rawLender?: string | null): string | null {
  if (rawLender === undefined || rawLender === null) {
    return null;
  }
  const trimmed = rawLender.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_LENDER_LENGTH) {
    throw new Error(`Lender name exceeds maximum length of ${MAX_LENDER_LENGTH} characters`);
  }
  return trimmed;
}

export function validateNotes(rawNotes?: string | null): string | null {
  if (rawNotes === undefined || rawNotes === null) {
    return null;
  }
  const trimmed = rawNotes.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes exceed maximum length of ${MAX_NOTES_LENGTH} characters`);
  }
  return trimmed;
}

export function validateVoidReason(reason?: string | null): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_VOID_REASON_LENGTH) {
    throw new Error(`Void reason must be at most ${MAX_VOID_REASON_LENGTH} characters`);
  }
  return trimmed;
}

export function validateObservedOutstandingSnapshot(
  observedOutstanding: Money | null | undefined,
  observedOutstandingAt: Date | null | undefined,
  expectedCurrency: CurrencyCode,
): { amount: Money | null; at: Date | null } {
  const hasAmount = observedOutstanding !== undefined && observedOutstanding !== null;
  const hasDate = observedOutstandingAt !== undefined && observedOutstandingAt !== null;

  if (hasAmount !== hasDate) {
    throw new Error(
      "Observed outstanding amount and observation date must both be provided or both be null",
    );
  }

  if (!hasAmount) {
    return { amount: null, at: null };
  }

  const validAmount = observedOutstanding!;
  if (validAmount.currency !== expectedCurrency) {
    throw new Error(
      `Observed outstanding currency (${validAmount.currency}) does not match liability currency (${expectedCurrency})`,
    );
  }

  if (validAmount.amountMinor < 0n) {
    throw new Error("Observed outstanding amount cannot be negative");
  }

  if (Number.isNaN(observedOutstandingAt!.getTime())) {
    throw new Error("Invalid observed outstanding snapshot date");
  }

  return { amount: validAmount, at: new Date(observedOutstandingAt!.getTime()) };
}

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export function createLiability(input: CreateLiabilityInput): Liability {
  const name = validateLiabilityName(input.name);
  const currency = currencyCode(input.currency);
  const kind = input.kind ?? "loan";
  if (!isLiabilityKind(kind)) {
    throw new Error(`Invalid liability kind: ${input.kind}`);
  }

  const { amount: observedOutstanding, at: observedOutstandingAt } =
    validateObservedOutstandingSnapshot(
      input.observedOutstanding,
      input.observedOutstandingAt,
      currency,
    );

  const lender = validateLender(input.lender);
  const notes = validateNotes(input.notes);
  const now = new Date();

  return deepFreeze({
    id: input.id,
    householdId: input.householdId,
    name,
    kind,
    currency,
    observedOutstanding,
    observedOutstandingAt,
    responsiblePersonId: input.responsiblePersonId ?? null,
    lender,
    destinationAccountId: input.destinationAccountId ?? null,
    notes,
    version: input.version ?? 1,
    archivedAt: input.archivedAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}

export function updateLiability(
  existing: Liability,
  input: UpdateLiabilityInput,
): Liability {
  const name =
    input.name !== undefined ? validateLiabilityName(input.name) : existing.name;
  const kind =
    input.kind !== undefined ? input.kind : existing.kind;
  if (!isLiabilityKind(kind)) {
    throw new Error(`Invalid liability kind: ${kind}`);
  }

  let observedOutstanding = existing.observedOutstanding;
  let observedOutstandingAt = existing.observedOutstandingAt;

  if (
    input.observedOutstanding !== undefined ||
    input.observedOutstandingAt !== undefined
  ) {
    const nextAmount =
      input.observedOutstanding !== undefined
        ? input.observedOutstanding
        : existing.observedOutstanding;
    const nextDate =
      input.observedOutstandingAt !== undefined
        ? input.observedOutstandingAt
        : existing.observedOutstandingAt;

    const validated = validateObservedOutstandingSnapshot(
      nextAmount,
      nextDate,
      existing.currency,
    );
    observedOutstanding = validated.amount;
    observedOutstandingAt = validated.at;
  }

  const lender =
    input.lender !== undefined
      ? validateLender(input.lender)
      : existing.lender;

  const destinationAccountId =
    input.destinationAccountId !== undefined
      ? input.destinationAccountId
      : existing.destinationAccountId;

  const responsiblePersonId =
    input.responsiblePersonId !== undefined
      ? input.responsiblePersonId
      : existing.responsiblePersonId;

  const notes =
    input.notes !== undefined
      ? validateNotes(input.notes)
      : existing.notes;

  return deepFreeze({
    ...existing,
    name,
    kind,
    observedOutstanding,
    observedOutstandingAt,
    responsiblePersonId,
    lender,
    destinationAccountId,
    notes,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function archiveLiability(
  liability: Liability,
  archivedAt: Date = new Date(),
): Liability {
  if (liability.archivedAt !== null) {
    return liability;
  }
  return deepFreeze({
    ...liability,
    archivedAt: new Date(archivedAt.getTime()),
    version: liability.version + 1,
    updatedAt: new Date(),
  });
}

export function unarchiveLiability(liability: Liability): Liability {
  if (liability.archivedAt === null) {
    return liability;
  }
  return deepFreeze({
    ...liability,
    archivedAt: null,
    version: liability.version + 1,
    updatedAt: new Date(),
  });
}

export function isLiabilityArchived(liability: Liability): boolean {
  return liability.archivedAt !== null;
}

export function determineRepaymentAllocationState(
  amount: Money,
  principal: Money | null,
  interest: Money | null,
  fee: Money | null,
): RepaymentAllocationState {
  const isPrincipalKnown = principal !== null;
  const isInterestKnown = interest !== null;
  const isFeeKnown = fee !== null;

  if (!isPrincipalKnown && !isInterestKnown && !isFeeKnown) {
    return "unknown";
  }

  const pMinor = principal?.amountMinor ?? 0n;
  const iMinor = interest?.amountMinor ?? 0n;
  const fMinor = fee?.amountMinor ?? 0n;
  const sumMinor = pMinor + iMinor + fMinor;

  if (isPrincipalKnown && isInterestKnown && isFeeKnown && sumMinor === amount.amountMinor) {
    return "full";
  }

  return "partial";
}

export function createLiabilityRepayment(
  input: CreateLiabilityRepaymentInput,
): LiabilityRepayment {
  if (input.amount.amountMinor <= 0n) {
    throw new Error("Repayment amount must be strictly positive");
  }

  const currency = input.amount.currency;
  const principal = input.principalAmount ?? null;
  const interest = input.interestAmount ?? null;
  const fee = input.feeAmount ?? null;

  if (principal !== null) {
    if (principal.currency !== currency) {
      throw new Error("Principal amount currency must match total repayment currency");
    }
    if (principal.amountMinor < 0n) {
      throw new Error("Principal amount cannot be negative");
    }
  }

  if (interest !== null) {
    if (interest.currency !== currency) {
      throw new Error("Interest amount currency must match total repayment currency");
    }
    if (interest.amountMinor < 0n) {
      throw new Error("Interest amount cannot be negative");
    }
  }

  if (fee !== null) {
    if (fee.currency !== currency) {
      throw new Error("Fee amount currency must match total repayment currency");
    }
    if (fee.amountMinor < 0n) {
      throw new Error("Fee amount cannot be negative");
    }
  }

  const allocatedSum =
    (principal?.amountMinor ?? 0n) +
    (interest?.amountMinor ?? 0n) +
    (fee?.amountMinor ?? 0n);

  if (allocatedSum > input.amount.amountMinor) {
    throw new Error(
      `Sum of allocated components (${allocatedSum}) exceeds total repayment amount (${input.amount.amountMinor})`,
    );
  }

  // If ALL three components are explicitly supplied, they MUST sum to total repayment amount
  if (principal !== null && interest !== null && fee !== null && allocatedSum !== input.amount.amountMinor) {
    throw new Error(
      `When principal (${principal.amountMinor}), interest (${interest.amountMinor}), and fee (${fee.amountMinor}) are all supplied, they must sum exactly to total repayment amount (${input.amount.amountMinor})`,
    );
  }

  const allocationState = determineRepaymentAllocationState(
    input.amount,
    principal,
    interest,
    fee,
  );

  const notes = validateNotes(input.notes);
  const voidReason = validateVoidReason(input.voidReason);
  const now = new Date();

  return deepFreeze({
    id: input.id,
    householdId: input.householdId,
    liabilityId: input.liabilityId,
    transactionId: input.transactionId ?? null,
    paidAt: new Date(input.paidAt.getTime()),
    amount: input.amount,
    principalAmount: principal,
    interestAmount: interest,
    feeAmount: fee,
    allocationState,
    notes,
    version: input.version ?? 1,
    voidedAt: input.voidedAt ? new Date(input.voidedAt.getTime()) : null,
    voidReason,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}

export function voidLiabilityRepayment(
  repayment: LiabilityRepayment,
  reason?: string | null,
  voidedAt: Date = new Date(),
): LiabilityRepayment {
  if (repayment.voidedAt !== null) {
    throw new Error("Repayment is already voided");
  }
  const validVoidedAt = new Date(voidedAt.getTime());
  const normalizedReason = validateVoidReason(reason);

  return deepFreeze({
    ...repayment,
    version: repayment.version + 1,
    voidedAt: validVoidedAt,
    voidReason: normalizedReason,
    updatedAt: new Date(),
  });
}

export function isLiabilityRepaymentVoided(repayment: LiabilityRepayment): boolean {
  return repayment.voidedAt !== null;
}
