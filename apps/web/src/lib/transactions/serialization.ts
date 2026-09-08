import type { Transaction } from "@nodvis/finance-domain";

import type {
  SerializedExpenseTransaction,
  SerializedIncomeTransaction,
  SerializedMoney,
  SerializedTransaction,
  SerializedTransferTransaction,
} from "./schema";

export function serializeTransaction(tx: Transaction): SerializedTransaction {
  const serializedAmount: SerializedMoney = {
    amountMinor: tx.amount.amountMinor.toString(),
    currency: tx.amount.currency,
  };

  const base = {
    id: tx.id,
    householdId: tx.householdId,
    amount: serializedAmount,
    occurredOn: tx.occurredOn.toISOString(),
  };

  if (tx.kind === "expense") {
    const expense: SerializedExpenseTransaction = {
      ...base,
      kind: "expense",
      accountId: tx.accountId,
      payee: tx.payee,
      paidByPersonId: tx.paidByPersonId,
      categoryId: tx.categoryId ?? null,
    };
    return expense;
  }

  if (tx.kind === "income") {
    const income: SerializedIncomeTransaction = {
      ...base,
      kind: "income",
      accountId: tx.accountId,
      source: tx.source,
      receivedByPersonId: tx.receivedByPersonId,
      categoryId: tx.categoryId ?? null,
    };
    return income;
  }

  const transfer: SerializedTransferTransaction = {
    ...base,
    kind: "transfer",
    fromAccountId: tx.fromAccountId,
    toAccountId: tx.toAccountId,
  };
  return transfer;
}
