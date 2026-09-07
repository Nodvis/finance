import { and, desc, eq, or } from "drizzle-orm";

import {
  accountId,
  createExpense,
  createIncome,
  createTransfer,
  householdId,
  money,
  personId,
  transactionId,
} from "@nodvis/finance-domain";
import type {
  Transaction,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { transactions } from "../schema/transactions";

export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransactionRow = typeof transactions.$inferInsert;

export function mapRowToTransaction(row: TransactionRow): Transaction {
  const amount = money(row.amountMinor, row.currency);
  const id = transactionId(row.id);
  const hId = householdId(row.householdId);

  if (row.kind === "expense") {
    if (!row.accountId || !row.payee || !row.paidByPersonId) {
      throw new Error(`Corrupted expense transaction row: ${row.id}`);
    }
    return createExpense({
      id,
      householdId: hId,
      accountId: accountId(row.accountId),
      amount,
      payee: row.payee,
      paidByPersonId: personId(row.paidByPersonId),
      occurredOn: row.occurredOn,
    });
  }

  if (row.kind === "income") {
    if (!row.accountId || !row.source || !row.receivedByPersonId) {
      throw new Error(`Corrupted income transaction row: ${row.id}`);
    }
    return createIncome({
      id,
      householdId: hId,
      accountId: accountId(row.accountId),
      amount,
      source: row.source,
      receivedByPersonId: personId(row.receivedByPersonId),
      occurredOn: row.occurredOn,
    });
  }

  if (row.kind === "transfer") {
    if (!row.fromAccountId || !row.toAccountId) {
      throw new Error(`Corrupted transfer transaction row: ${row.id}`);
    }
    return createTransfer({
      id,
      householdId: hId,
      fromAccountId: accountId(row.fromAccountId),
      toAccountId: accountId(row.toAccountId),
      amount,
      occurredOn: row.occurredOn,
    });
  }

  throw new Error(`Unknown transaction kind: ${(row as { kind: string }).kind}`);
}

export async function insertTransaction(tx: Transaction): Promise<Transaction> {
  const baseValues = {
    id: tx.id,
    householdId: tx.householdId,
    kind: tx.kind,
    amountMinor: tx.amount.amountMinor,
    currency: tx.amount.currency,
    occurredOn: tx.occurredOn,
  };

  let values: NewTransactionRow;
  if (tx.kind === "expense") {
    values = {
      ...baseValues,
      accountId: tx.accountId,
      payee: tx.payee,
      paidByPersonId: tx.paidByPersonId,
      source: null,
      receivedByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };
  } else if (tx.kind === "income") {
    values = {
      ...baseValues,
      accountId: tx.accountId,
      source: tx.source,
      receivedByPersonId: tx.receivedByPersonId,
      payee: null,
      paidByPersonId: null,
      fromAccountId: null,
      toAccountId: null,
    };
  } else {
    values = {
      ...baseValues,
      fromAccountId: tx.fromAccountId,
      toAccountId: tx.toAccountId,
      accountId: null,
      payee: null,
      paidByPersonId: null,
      source: null,
      receivedByPersonId: null,
    };
  }

  const [inserted] = await getDb()
    .insert(transactions)
    .values(values)
    .returning();

  if (!inserted) {
    throw new Error("Failed to insert transaction");
  }

  return mapRowToTransaction(inserted);
}

export type ListTransactionsParams = {
  householdId: string;
  accountId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function listTransactionsByHousehold(
  params: ListTransactionsParams,
): Promise<Transaction[]> {
  const conditions = [eq(transactions.householdId, params.householdId)];

  if (params.accountId) {
    conditions.push(
      or(
        eq(transactions.accountId, params.accountId),
        eq(transactions.fromAccountId, params.accountId),
        eq(transactions.toAccountId, params.accountId),
      )!,
    );
  }

  let query = getDb()
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));

  if (typeof params.limit === "number" && params.limit > 0) {
    query = query.limit(params.limit) as typeof query;
  }
  if (typeof params.offset === "number" && params.offset > 0) {
    query = query.offset(params.offset) as typeof query;
  }

  const rows = await query;
  return rows.map(mapRowToTransaction);
}

export async function findTransactionById(
  householdId: string,
  id: string,
): Promise<Transaction | null> {
  const [row] = await getDb()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.id, id),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return mapRowToTransaction(row);
}
