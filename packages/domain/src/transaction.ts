import type { AccountId, HouseholdId, PersonId, TransactionId } from "./identity";
import type { Money } from "./money";
import { addMoney, money, negateMoney } from "./money";

export const TRANSACTION_KINDS = ["expense", "income", "transfer"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export type ExpenseTransaction = Readonly<{
  id: TransactionId;
  householdId: HouseholdId;
  kind: "expense";
  accountId: AccountId; // ownership context
  amount: Money; // positive magnitude
  payee: string; // counterparty / merchant
  paidByPersonId: PersonId; // payer (transaction context, distinct from account owner)
  occurredOn: Date;
}>;

export type IncomeTransaction = Readonly<{
  id: TransactionId;
  householdId: HouseholdId;
  kind: "income";
  accountId: AccountId;
  amount: Money; // positive magnitude
  source: string; // counterparty / source
  receivedByPersonId: PersonId; // beneficiary (transaction context)
  occurredOn: Date;
}>;

export type TransferTransaction = Readonly<{
  id: TransactionId;
  householdId: HouseholdId;
  kind: "transfer";
  fromAccountId: AccountId;
  toAccountId: AccountId;
  amount: Money; // positive magnitude
  occurredOn: Date;
}>;

export type Transaction =
  | ExpenseTransaction
  | IncomeTransaction
  | TransferTransaction;

const MAX_COUNTERPARTY_LENGTH = 160;

function assertPositiveAmount(amount: Money): void {
  if (!amount || typeof amount.amountMinor !== "bigint" || amount.amountMinor <= 0n) {
    throw new Error(
      `Transaction amount must be strictly positive: received ${amount?.amountMinor}`,
    );
  }
}

function assertValidDate(occurredOn: Date): Date {
  if (!occurredOn || !(occurredOn instanceof Date) || Number.isNaN(occurredOn.getTime())) {
    throw new Error("Invalid transaction date: occurredOn must be a valid Date");
  }
  return new Date(occurredOn.getTime());
}

function normalizeCounterparty(value: string, fieldName: "payee" | "source"): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > MAX_COUNTERPARTY_LENGTH) {
    throw new Error(
      `Invalid transaction ${fieldName}: must be non-blank and at most ${MAX_COUNTERPARTY_LENGTH} characters`,
    );
  }
  return normalized;
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

export function createExpense(input: {
  id: TransactionId;
  householdId: HouseholdId;
  accountId: AccountId;
  amount: Money;
  payee: string;
  paidByPersonId: PersonId;
  occurredOn: Date;
}): ExpenseTransaction {
  assertPositiveAmount(input.amount);
  const occurredOn = assertValidDate(input.occurredOn);
  const payee = normalizeCounterparty(input.payee, "payee");

  return deepFreeze({
    id: input.id,
    householdId: input.householdId,
    kind: "expense" as const,
    accountId: input.accountId,
    amount: input.amount,
    payee,
    paidByPersonId: input.paidByPersonId,
    occurredOn,
  });
}

export function createIncome(input: {
  id: TransactionId;
  householdId: HouseholdId;
  accountId: AccountId;
  amount: Money;
  source: string;
  receivedByPersonId: PersonId;
  occurredOn: Date;
}): IncomeTransaction {
  assertPositiveAmount(input.amount);
  const occurredOn = assertValidDate(input.occurredOn);
  const source = normalizeCounterparty(input.source, "source");

  return deepFreeze({
    id: input.id,
    householdId: input.householdId,
    kind: "income" as const,
    accountId: input.accountId,
    amount: input.amount,
    source,
    receivedByPersonId: input.receivedByPersonId,
    occurredOn,
  });
}

export function createTransfer(input: {
  id: TransactionId;
  householdId: HouseholdId;
  fromAccountId: AccountId;
  toAccountId: AccountId;
  amount: Money;
  occurredOn: Date;
}): TransferTransaction {
  assertPositiveAmount(input.amount);
  const occurredOn = assertValidDate(input.occurredOn);

  if (input.fromAccountId === input.toAccountId) {
    throw new Error(
      "Transfer fromAccountId and toAccountId must be different (self-transfer rejected)",
    );
  }

  return deepFreeze({
    id: input.id,
    householdId: input.householdId,
    kind: "transfer" as const,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    occurredOn,
  });
}

export function transactionKind(tx: Transaction): TransactionKind {
  return tx.kind;
}

export function isExpense(tx: Transaction): tx is ExpenseTransaction {
  return tx.kind === "expense";
}

export function isIncome(tx: Transaction): tx is IncomeTransaction {
  return tx.kind === "income";
}

export function isTransfer(tx: Transaction): tx is TransferTransaction {
  return tx.kind === "transfer";
}

export type LedgerEntry = Readonly<{ accountId: AccountId; effect: Money }>;

// Signed per-account balance movements.
//   expense:  [{ accountId, effect: -amount }]
//   income:   [{ accountId, effect: +amount }]
//   transfer: [{ fromAccountId, effect: -amount }, { toAccountId, effect: +amount }]
export function ledgerEntries(tx: Transaction): readonly LedgerEntry[] {
  switch (tx.kind) {
    case "expense":
      return Object.freeze([
        Object.freeze({
          accountId: tx.accountId,
          effect: negateMoney(tx.amount),
        }),
      ]);
    case "income":
      return Object.freeze([
        Object.freeze({
          accountId: tx.accountId,
          effect: tx.amount,
        }),
      ]);
    case "transfer":
      return Object.freeze([
        Object.freeze({
          accountId: tx.fromAccountId,
          effect: negateMoney(tx.amount),
        }),
        Object.freeze({
          accountId: tx.toAccountId,
          effect: tx.amount,
        }),
      ]);
  }
}

// Sum of ledgerEntries effects (single currency). Exactly zero for transfers.
export function netMoneyEffect(tx: Transaction): Money {
  const entries = ledgerEntries(tx);
  let total = money(0n, tx.amount.currency);
  for (const entry of entries) {
    total = addMoney(total, entry.effect);
  }
  return total;
}
