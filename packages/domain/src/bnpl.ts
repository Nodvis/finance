import type {
  CreditFacilityId,
  HouseholdId,
  BnplPurchaseId,
  TransactionId,
} from "./identity";
import type { CurrencyCode, Money } from "./money";
import { currencyCode, money } from "./money";

export const BNPL_PAYMENT_MODELS = [
  "pay_in_full",
  "pay_in_30",
  "installments",
  "split_pay",
  "revolving",
  "other",
] as const;

export type BnplPaymentModel = (typeof BNPL_PAYMENT_MODELS)[number];

export const BNPL_PURCHASE_STATUSES = [
  "pending",
  "active",
  "settled",
  "overdue",
  "cancelled",
  "defaulted",
] as const;

export type BnplPurchaseStatus = (typeof BNPL_PURCHASE_STATUSES)[number];

export type BnplPurchase = Readonly<{
  id: BnplPurchaseId;
  householdId: HouseholdId;
  creditFacilityId: CreditFacilityId;
  provider: string;
  product: string;
  merchant: string;
  description: string | null;
  purchaseDate: Date;
  financingDate: Date;
  originalAmount: Money;
  financedAmount: Money;
  currency: CurrencyCode;
  observedOutstanding: Money | null;
  observedOutstandingAt: Date | null;
  paymentModel: BnplPaymentModel;
  status: BnplPurchaseStatus;
  dueDate: Date | null;
  principalAmount: Money | null;
  interestAmount: Money | null;
  feeAmount: Money | null;
  transactionId: TransactionId | null;
  version: number;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateBnplPurchaseInput = Readonly<{
  id: BnplPurchaseId;
  householdId: HouseholdId;
  creditFacilityId: CreditFacilityId;
  provider: string;
  product: string;
  merchant: string;
  description?: string | null;
  purchaseDate: Date;
  financingDate?: Date;
  originalAmount: Money;
  financedAmount: Money;
  currency: string;
  observedOutstanding?: Money | null;
  observedOutstandingAt?: Date | null;
  paymentModel?: BnplPaymentModel;
  status?: BnplPurchaseStatus;
  dueDate?: Date | null;
  principalAmount?: Money | null;
  interestAmount?: Money | null;
  feeAmount?: Money | null;
  transactionId?: TransactionId | null;
  version?: number;
  voidedAt?: Date | null;
  voidReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}>;

export type UpdateBnplPurchaseInput = Readonly<{
  provider?: string;
  product?: string;
  merchant?: string;
  description?: string | null;
  purchaseDate?: Date;
  financingDate?: Date;
  originalAmount?: Money;
  financedAmount?: Money;
  observedOutstanding?: Money | null;
  observedOutstandingAt?: Date | null;
  paymentModel?: BnplPaymentModel;
  status?: BnplPurchaseStatus;
  dueDate?: Date | null;
  principalAmount?: Money | null;
  interestAmount?: Money | null;
  feeAmount?: Money | null;
  transactionId?: TransactionId | null;
}>;

const MAX_PROVIDER_LENGTH = 160;
const MAX_PRODUCT_LENGTH = 160;
const MAX_MERCHANT_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 280;
const MAX_VOID_REASON_LENGTH = 280;

export function isBnplPaymentModel(value: string): value is BnplPaymentModel {
  return (BNPL_PAYMENT_MODELS as readonly string[]).includes(
    value as BnplPaymentModel,
  );
}

export function isBnplPurchaseStatus(value: string): value is BnplPurchaseStatus {
  return (BNPL_PURCHASE_STATUSES as readonly string[]).includes(
    value as BnplPurchaseStatus,
  );
}

export function validateBnplString(
  raw: string,
  field: string,
  maxLength: number,
): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} cannot be blank`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds maximum length of ${maxLength} characters`);
  }
  return trimmed;
}

export function validateBnplOptionalString(
  raw?: string | null,
  field = "Description",
  maxLength = MAX_DESCRIPTION_LENGTH,
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds maximum length of ${maxLength} characters`);
  }
  return trimmed;
}

export function validateBnplVoidReason(reason?: string | null): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_VOID_REASON_LENGTH) {
    throw new Error(
      `Void reason must be at most ${MAX_VOID_REASON_LENGTH} characters`,
    );
  }
  return trimmed;
}

export function validateBnplObservedOutstanding(
  observedOutstanding: Money | null | undefined,
  observedOutstandingAt: Date | null | undefined,
  expectedCurrency: CurrencyCode,
): { amount: Money | null; at: Date | null } {
  const hasAmount =
    observedOutstanding !== undefined && observedOutstanding !== null;
  const hasDate =
    observedOutstandingAt !== undefined && observedOutstandingAt !== null;

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
      `Observed outstanding currency (${validAmount.currency}) does not match purchase currency (${expectedCurrency})`,
    );
  }

  if (validAmount.amountMinor < 0n) {
    throw new Error("Observed outstanding amount cannot be negative");
  }

  if (Number.isNaN(observedOutstandingAt!.getTime())) {
    throw new Error("Invalid observed outstanding snapshot date");
  }

  return {
    amount: validAmount,
    at: new Date(observedOutstandingAt!.getTime()),
  };
}

export function validateBnplAllocation(
  amount: Money | null | undefined,
  label: string,
  expectedCurrency: CurrencyCode,
): Money | null {
  if (amount === undefined || amount === null) {
    return null;
  }
  if (amount.currency !== expectedCurrency) {
    throw new Error(
      `${label} currency (${amount.currency}) does not match purchase currency (${expectedCurrency})`,
    );
  }
  if (amount.amountMinor < 0n) {
    throw new Error(`${label} cannot be negative`);
  }
  return amount;
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

export function createBnplPurchase(input: CreateBnplPurchaseInput): BnplPurchase {
  const provider = validateBnplString(
    input.provider,
    "Provider",
    MAX_PROVIDER_LENGTH,
  );
  const product = validateBnplString(
    input.product,
    "Product",
    MAX_PRODUCT_LENGTH,
  );
  const merchant = validateBnplString(
    input.merchant,
    "Merchant",
    MAX_MERCHANT_LENGTH,
  );
  const description = validateBnplOptionalString(input.description);

  const currency = currencyCode(input.currency);

  if (input.originalAmount.currency !== currency) {
    throw new Error(
      `Original amount currency (${input.originalAmount.currency}) does not match purchase currency (${currency})`,
    );
  }
  if (input.originalAmount.amountMinor <= 0n) {
    throw new Error("Original amount must be strictly positive");
  }

  if (input.financedAmount.currency !== currency) {
    throw new Error(
      `Financed amount currency (${input.financedAmount.currency}) does not match purchase currency (${currency})`,
    );
  }
  if (input.financedAmount.amountMinor <= 0n) {
    throw new Error("Financed amount must be strictly positive");
  }

  if (Number.isNaN(input.purchaseDate.getTime())) {
    throw new Error("Invalid purchase date");
  }

  const purchaseDate = new Date(input.purchaseDate.getTime());
  const financingDate = input.financingDate
    ? new Date(input.financingDate.getTime())
    : new Date(purchaseDate.getTime());

  if (Number.isNaN(financingDate.getTime())) {
    throw new Error("Invalid financing date");
  }

  const { amount: observedOutstanding, at: observedOutstandingAt } =
    validateBnplObservedOutstanding(
      input.observedOutstanding,
      input.observedOutstandingAt,
      currency,
    );

  const paymentModel = input.paymentModel ?? "pay_in_30";
  if (!isBnplPaymentModel(paymentModel)) {
    throw new Error(`Invalid BNPL payment model: ${input.paymentModel}`);
  }

  const status = input.status ?? "active";
  if (!isBnplPurchaseStatus(status)) {
    throw new Error(`Invalid BNPL purchase status: ${input.status}`);
  }

  const dueDate = input.dueDate ? new Date(input.dueDate.getTime()) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    throw new Error("Invalid due date");
  }

  const principal = validateBnplAllocation(
    input.principalAmount,
    "Principal amount",
    currency,
  );
  const interest = validateBnplAllocation(
    input.interestAmount,
    "Interest amount",
    currency,
  );
  const fee = validateBnplAllocation(
    input.feeAmount,
    "Fee amount",
    currency,
  );

  const voidReason = validateBnplVoidReason(input.voidReason);
  const now = new Date();

  return deepFreeze({
    id: input.id,
    householdId: input.householdId,
    creditFacilityId: input.creditFacilityId,
    provider,
    product,
    merchant,
    description,
    purchaseDate,
    financingDate,
    originalAmount: input.originalAmount,
    financedAmount: input.financedAmount,
    currency,
    observedOutstanding,
    observedOutstandingAt,
    paymentModel,
    status,
    dueDate,
    principalAmount: principal,
    interestAmount: interest,
    feeAmount: fee,
    transactionId: input.transactionId ?? null,
    version: input.version ?? 1,
    voidedAt: input.voidedAt ? new Date(input.voidedAt.getTime()) : null,
    voidReason,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}

export function updateBnplPurchase(
  existing: BnplPurchase,
  input: UpdateBnplPurchaseInput,
): BnplPurchase {
  if (existing.voidedAt !== null) {
    throw new Error("Cannot update a voided BNPL purchase");
  }

  const provider =
    input.provider !== undefined
      ? validateBnplString(input.provider, "Provider", MAX_PROVIDER_LENGTH)
      : existing.provider;

  const product =
    input.product !== undefined
      ? validateBnplString(input.product, "Product", MAX_PRODUCT_LENGTH)
      : existing.product;

  const merchant =
    input.merchant !== undefined
      ? validateBnplString(input.merchant, "Merchant", MAX_MERCHANT_LENGTH)
      : existing.merchant;

  const description =
    input.description !== undefined
      ? validateBnplOptionalString(input.description)
      : existing.description;

  const purchaseDate = input.purchaseDate
    ? new Date(input.purchaseDate.getTime())
    : existing.purchaseDate;
  if (Number.isNaN(purchaseDate.getTime())) {
    throw new Error("Invalid purchase date");
  }

  const financingDate = input.financingDate
    ? new Date(input.financingDate.getTime())
    : existing.financingDate;
  if (Number.isNaN(financingDate.getTime())) {
    throw new Error("Invalid financing date");
  }

  let originalAmount = existing.originalAmount;
  if (input.originalAmount !== undefined) {
    if (input.originalAmount.currency !== existing.currency) {
      throw new Error(
        `Original amount currency (${input.originalAmount.currency}) does not match purchase currency (${existing.currency})`,
      );
    }
    if (input.originalAmount.amountMinor <= 0n) {
      throw new Error("Original amount must be strictly positive");
    }
    originalAmount = input.originalAmount;
  }

  let financedAmount = existing.financedAmount;
  if (input.financedAmount !== undefined) {
    if (input.financedAmount.currency !== existing.currency) {
      throw new Error(
        `Financed amount currency (${input.financedAmount.currency}) does not match purchase currency (${existing.currency})`,
      );
    }
    if (input.financedAmount.amountMinor <= 0n) {
      throw new Error("Financed amount must be strictly positive");
    }
    financedAmount = input.financedAmount;
  }

  let observedOutstanding = existing.observedOutstanding;
  let observedOutstandingAt = existing.observedOutstandingAt;
  if (
    input.observedOutstanding !== undefined ||
    input.observedOutstandingAt !== undefined
  ) {
    const validated = validateBnplObservedOutstanding(
      input.observedOutstanding !== undefined
        ? input.observedOutstanding
        : existing.observedOutstanding,
      input.observedOutstandingAt !== undefined
        ? input.observedOutstandingAt
        : existing.observedOutstandingAt,
      existing.currency,
    );
    observedOutstanding = validated.amount;
    observedOutstandingAt = validated.at;
  }

  let paymentModel = existing.paymentModel;
  if (input.paymentModel !== undefined) {
    if (!isBnplPaymentModel(input.paymentModel)) {
      throw new Error(`Invalid BNPL payment model: ${input.paymentModel}`);
    }
    paymentModel = input.paymentModel;
  }

  let status = existing.status;
  if (input.status !== undefined) {
    if (!isBnplPurchaseStatus(input.status)) {
      throw new Error(`Invalid BNPL purchase status: ${input.status}`);
    }
    status = input.status;
  }

  let dueDate = existing.dueDate;
  if (input.dueDate !== undefined) {
    dueDate = input.dueDate ? new Date(input.dueDate.getTime()) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      throw new Error("Invalid due date");
    }
  }

  const principal =
    input.principalAmount !== undefined
      ? validateBnplAllocation(
          input.principalAmount,
          "Principal amount",
          existing.currency,
        )
      : existing.principalAmount;

  const interest =
    input.interestAmount !== undefined
      ? validateBnplAllocation(
          input.interestAmount,
          "Interest amount",
          existing.currency,
        )
      : existing.interestAmount;

  const fee =
    input.feeAmount !== undefined
      ? validateBnplAllocation(
          input.feeAmount,
          "Fee amount",
          existing.currency,
        )
      : existing.feeAmount;

  const transactionId =
    input.transactionId !== undefined
      ? input.transactionId
      : existing.transactionId;

  return deepFreeze({
    ...existing,
    provider,
    product,
    merchant,
    description,
    purchaseDate,
    financingDate,
    originalAmount,
    financedAmount,
    observedOutstanding,
    observedOutstandingAt,
    paymentModel,
    status,
    dueDate,
    principalAmount: principal,
    interestAmount: interest,
    feeAmount: fee,
    transactionId,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function voidBnplPurchase(
  purchase: BnplPurchase,
  reason?: string | null,
  voidedAt: Date = new Date(),
): BnplPurchase {
  if (purchase.voidedAt !== null) {
    throw new Error("BNPL purchase is already voided");
  }
  const validVoidedAt = new Date(voidedAt.getTime());
  const normalizedReason = validateBnplVoidReason(reason);

  return deepFreeze({
    ...purchase,
    version: purchase.version + 1,
    voidedAt: validVoidedAt,
    voidReason: normalizedReason,
    updatedAt: new Date(),
  });
}

export function isBnplPurchaseVoided(purchase: BnplPurchase): boolean {
  return purchase.voidedAt !== null;
}
