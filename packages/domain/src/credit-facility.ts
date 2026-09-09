import type { CurrencyCode, Money } from "./money";
import { currencyCode, money } from "./money";

export const CREDIT_FACILITY_KINDS = [
  "overdraft",
  "revolving",
  "credit_card",
  "bnpl",
] as const;

export type CreditFacilityKind = (typeof CREDIT_FACILITY_KINDS)[number];

export type CreditFacility = Readonly<{
  id: string;
  householdId: string;
  accountId: string | null;
  kind: CreditFacilityKind;
  name: string;
  currency: CurrencyCode;
  approvedLimit: Money | null;
  observedUsed: Money | null;
  observedAvailable: Money | null;
  observedAt: Date | null;
  effectiveFrom: Date | null;
  expiresAt: Date | null;
  archivedAt: Date | null;
}>;

export type CreditCapacity = Readonly<{
  currency: CurrencyCode;
  ownFundsMinor: bigint | null;
  usedBorrowingMinor: bigint | null;
  availableBorrowingMinor: bigint | null;
  combinedCapacityMinor: bigint | null;
  basis: "calculated" | "observed" | "unknown";
  warning: "over_limit" | "inconsistent_observation" | null;
}>;

export function computeOverdraftCapacity(input: {
  currency: string;
  accountBalanceMinor: bigint | null;
  approvedLimitMinor: bigint | null;
  observedUsedMinor?: bigint | null;
  observedAvailableMinor?: bigint | null;
  active?: boolean;
}): CreditCapacity {
  const currency = currencyCode(input.currency);
  const ownFundsMinor =
    input.accountBalanceMinor === null
      ? null
      : input.accountBalanceMinor > 0n
        ? input.accountBalanceMinor
        : 0n;

  if (input.active === false) {
    return Object.freeze({
      currency,
      ownFundsMinor,
      usedBorrowingMinor:
        input.accountBalanceMinor === null
          ? input.observedUsedMinor ?? null
          : input.accountBalanceMinor < 0n
            ? -input.accountBalanceMinor
            : 0n,
      availableBorrowingMinor: 0n,
      combinedCapacityMinor: ownFundsMinor,
      basis: "calculated",
      warning: null,
    });
  }

  const usedBorrowingMinor =
    input.observedUsedMinor !== undefined && input.observedUsedMinor !== null
      ? input.observedUsedMinor
      : input.accountBalanceMinor === null
        ? null
        : input.accountBalanceMinor < 0n
          ? -input.accountBalanceMinor
          : 0n;

  const availableBorrowingMinor =
    input.observedAvailableMinor !== undefined && input.observedAvailableMinor !== null
      ? input.observedAvailableMinor
      : input.approvedLimitMinor === null || usedBorrowingMinor === null
        ? null
        : input.approvedLimitMinor > usedBorrowingMinor
          ? input.approvedLimitMinor - usedBorrowingMinor
          : 0n;

  const overLimit = input.approvedLimitMinor !== null && usedBorrowingMinor !== null && usedBorrowingMinor > input.approvedLimitMinor;
  const inconsistentObservation = input.observedUsedMinor !== undefined && input.observedUsedMinor !== null && input.observedAvailableMinor !== undefined && input.observedAvailableMinor !== null && input.approvedLimitMinor !== null && input.observedUsedMinor + input.observedAvailableMinor !== input.approvedLimitMinor;

  return Object.freeze({
    currency,
    ownFundsMinor,
    usedBorrowingMinor,
    availableBorrowingMinor,
    combinedCapacityMinor:
      ownFundsMinor !== null && availableBorrowingMinor !== null
        ? ownFundsMinor + availableBorrowingMinor
        : null,
    basis:
      input.observedAvailableMinor !== undefined && input.observedAvailableMinor !== null
        ? "observed"
        : availableBorrowingMinor === null
          ? "unknown"
          : "calculated",
    warning: overLimit ? "over_limit" : inconsistentObservation ? "inconsistent_observation" : null,
  });
}

export type CreditCardCapacity = Readonly<{
  currency: CurrencyCode;
  creditLimitMinor: bigint | null;
  outstandingDebtMinor: bigint | null;
  overpaymentMinor: bigint | null;
  availableCreditMinor: bigint | null;
  basis: "calculated" | "observed" | "unknown";
  warning: "over_limit" | "inconsistent_observation" | null;
}>;

export function computeCreditCardCapacity(input: {
  currency: string;
  accountBalanceMinor: bigint | null;
  approvedLimitMinor: bigint | null;
  observedUsedMinor?: bigint | null;
  observedAvailableMinor?: bigint | null;
}): CreditCardCapacity {
  const currency = currencyCode(input.currency);
  const outstandingDebtMinor = input.observedUsedMinor ?? (input.accountBalanceMinor === null ? null : input.accountBalanceMinor < 0n ? -input.accountBalanceMinor : 0n);
  const overpaymentMinor = input.accountBalanceMinor === null ? null : input.accountBalanceMinor > 0n ? input.accountBalanceMinor : 0n;
  const availableCreditMinor = input.observedAvailableMinor ?? (input.approvedLimitMinor === null || outstandingDebtMinor === null ? null : input.approvedLimitMinor > outstandingDebtMinor ? input.approvedLimitMinor - outstandingDebtMinor : 0n);
  const overLimit = input.approvedLimitMinor !== null && outstandingDebtMinor !== null && outstandingDebtMinor > input.approvedLimitMinor;
  const inconsistentObservation = input.observedUsedMinor !== undefined && input.observedUsedMinor !== null && input.observedAvailableMinor !== undefined && input.observedAvailableMinor !== null && input.approvedLimitMinor !== null && input.observedUsedMinor + input.observedAvailableMinor !== input.approvedLimitMinor;
  return Object.freeze({ currency, creditLimitMinor: input.approvedLimitMinor, outstandingDebtMinor, overpaymentMinor, availableCreditMinor, basis: input.observedAvailableMinor !== undefined && input.observedAvailableMinor !== null ? "observed" : availableCreditMinor === null ? "unknown" : "calculated", warning: overLimit ? "over_limit" : inconsistentObservation ? "inconsistent_observation" : null });
}

export function validateCreditSnapshot(input: {
  currency: string;
  approvedLimit?: Money | null;
  observedUsed?: Money | null;
  observedAvailable?: Money | null;
  observedAt?: Date | null;
}): void {
  const currency = currencyCode(input.currency);
  for (const [label, value] of [
    ["approved limit", input.approvedLimit],
    ["observed used amount", input.observedUsed],
    ["observed available amount", input.observedAvailable],
  ] as const) {
    if (value !== null && value !== undefined) {
      if (value.currency !== currency) throw new Error(`${label} currency mismatch`);
      if (value.amountMinor < 0n) throw new Error(`${label} cannot be negative`);
    }
  }
  const hasObservation = input.observedUsed !== undefined && input.observedUsed !== null || input.observedAvailable !== undefined && input.observedAvailable !== null;
  const hasDate = input.observedAt !== undefined && input.observedAt !== null;
  if (hasObservation !== hasDate) throw new Error("Credit observations require an observation date");
  if (hasDate && Number.isNaN(input.observedAt!.getTime())) throw new Error("Invalid credit observation date");
}

export function creditMoney(amountMinor: bigint, currency: string): Money {
  return money(amountMinor, currency);
}
