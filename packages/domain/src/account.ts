import type { AccountId, HouseholdId, PersonId } from "./identity";
import type { CurrencyCode, Money } from "./money";
import { currencyCode } from "./money";

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "cash",
  "credit_card",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Point-in-time balance snapshot before transaction ledgering exists.
 *
 * Sign convention:
 * - Asset accounts (`checking`, `savings`, `cash`):
 *   - `amountMinor > 0n`: available positive funds (asset)
 *   - `amountMinor === 0n`: zero balance
 *   - `amountMinor < 0n`: overdraft
 * - Credit card accounts (`credit_card`):
 *   - `amountMinor < 0n`: outstanding debt owed to issuer (e.g. -20000n = 200.00 PLN liability)
 *   - `amountMinor === 0n`: zero balance owed
 *   - `amountMinor > 0n`: card overpayment / positive credit
 */
export type AccountBalanceSnapshot = Readonly<{
  balance: Money;
  capturedAt: Date;
}>;

export type Account = Readonly<{
  id: AccountId;
  householdId: HouseholdId;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  ownerPersonIds: readonly PersonId[];
  balanceSnapshot: AccountBalanceSnapshot | null;
}>;

export function accountType(value: string): AccountType {
  if (!ACCOUNT_TYPES.includes(value as AccountType)) {
    throw new Error(`Invalid account type: ${value}`);
  }
  return value as AccountType;
}

export function createAccount(input: {
  id: AccountId;
  householdId: HouseholdId;
  name: string;
  type: AccountType | string;
  currency: CurrencyCode | string;
  ownerPersonIds: readonly PersonId[];
  balanceSnapshot?: AccountBalanceSnapshot | null;
}): Account {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 160) {
    throw new Error("Invalid account name");
  }

  const type = accountType(input.type);
  const currency =
    typeof input.currency === "string"
      ? currencyCode(input.currency)
      : input.currency;
  const ownerPersonIds = [...new Set(input.ownerPersonIds)];

  if (ownerPersonIds.length === 0) {
    throw new Error("An account must have at least one owner");
  }

  const balanceSnapshot = input.balanceSnapshot ?? null;
  if (balanceSnapshot && balanceSnapshot.balance.currency !== currency) {
    throw new Error("Account balance snapshot currency mismatch");
  }
  if (balanceSnapshot && Number.isNaN(balanceSnapshot.capturedAt.getTime())) {
    throw new Error("Invalid account balance snapshot timestamp");
  }

  return Object.freeze({
    id: input.id,
    householdId: input.householdId,
    name,
    type,
    currency,
    ownerPersonIds: Object.freeze(ownerPersonIds),
    balanceSnapshot: balanceSnapshot
      ? Object.freeze({
          balance: balanceSnapshot.balance,
          capturedAt: new Date(balanceSnapshot.capturedAt),
        })
      : null,
  });
}

/**
 * Determines whether an account type contributes to the household's available cash.
 *
 * Credit card limits and debt never count as available cash (preserving INV-013).
 */
export function contributesToAvailableCash(type: AccountType): boolean {
  return type !== "credit_card";
}
