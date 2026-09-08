import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  accountId,
  categoryId,
  createExpense,
  createIncome,
  createMonthPeriod,
  createTransfer,
  householdId,
  money,
  parseMonthKey,
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

export class TransactionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionNotFoundError";
  }
}

export class TransactionAlreadyVoidedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionAlreadyVoidedError";
  }
}

export class TransactionVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionVersionConflictError";
  }
}

export class DuplicateSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateSubmissionError";
  }
}

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
      categoryId: row.categoryId ? categoryId(row.categoryId) : null,
      version: row.version,
      voidedAt: row.voidedAt,
      voidReason: row.voidReason,
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
      categoryId: row.categoryId ? categoryId(row.categoryId) : null,
      version: row.version,
      voidedAt: row.voidedAt,
      voidReason: row.voidReason,
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
      version: row.version,
      voidedAt: row.voidedAt,
      voidReason: row.voidReason,
    });
  }

  throw new Error(`Unknown transaction kind: ${(row as { kind: string }).kind}`);
}

export async function insertTransaction(
  tx: Transaction,
  options?: { submissionId?: string | undefined },
): Promise<Transaction> {
  const baseValues = {
    id: tx.id,
    householdId: tx.householdId,
    kind: tx.kind,
    amountMinor: tx.amount.amountMinor,
    currency: tx.amount.currency,
    occurredOn: tx.occurredOn,
    version: tx.version,
    voidedAt: tx.voidedAt ?? null,
    voidReason: tx.voidReason ?? null,
    submissionId: options?.submissionId?.trim() || null,
  };

  let values: NewTransactionRow;
  if (tx.kind === "expense") {
    values = {
      ...baseValues,
      accountId: tx.accountId,
      categoryId: tx.categoryId ?? null,
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
      categoryId: tx.categoryId ?? null,
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
      categoryId: null,
      payee: null,
      paidByPersonId: null,
      source: null,
      receivedByPersonId: null,
    };
  }

  try {
    const [inserted] = await getDb()
      .insert(transactions)
      .values(values)
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert transaction");
    }

    return mapRowToTransaction(inserted);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505" &&
      String((error as { detail?: string }).detail ?? "").includes("submission_id")
    ) {
      throw new DuplicateSubmissionError(
        `Duplicate submission rejected: submissionId ${options?.submissionId} already processed`,
      );
    }
    throw error;
  }
}

export async function updateTransactionInDb(params: {
  householdId: string;
  id: string;
  expectedVersion: number;
  transaction: Transaction;
}): Promise<Transaction> {
  const tx = params.transaction;
  const baseValues = {
    amountMinor: tx.amount.amountMinor,
    currency: tx.amount.currency,
    occurredOn: tx.occurredOn,
    version: params.expectedVersion + 1,
    updatedAt: new Date(),
  };

  let values: Partial<NewTransactionRow>;
  if (tx.kind === "expense") {
    values = {
      ...baseValues,
      kind: "expense",
      accountId: tx.accountId,
      categoryId: tx.categoryId ?? null,
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
      kind: "income",
      accountId: tx.accountId,
      categoryId: tx.categoryId ?? null,
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
      kind: "transfer",
      fromAccountId: tx.fromAccountId,
      toAccountId: tx.toAccountId,
      accountId: null,
      categoryId: null,
      payee: null,
      paidByPersonId: null,
      source: null,
      receivedByPersonId: null,
    };
  }

  const [updated] = await getDb()
    .update(transactions)
    .set(values)
    .where(
      and(
        eq(transactions.householdId, params.householdId),
        eq(transactions.id, params.id),
        eq(transactions.version, params.expectedVersion),
        isNull(transactions.voidedAt),
      ),
    )
    .returning();

  if (updated) {
    return mapRowToTransaction(updated);
  }

  const existing = await findTransactionById(params.householdId, params.id);
  if (!existing) {
    throw new TransactionNotFoundError(
      `Transaction ${params.id} not found in household`,
    );
  }
  if (existing.voidedAt !== null) {
    throw new TransactionAlreadyVoidedError(
      `Transaction ${params.id} is voided and cannot be edited`,
    );
  }
  if (existing.version !== params.expectedVersion) {
    throw new TransactionVersionConflictError(
      `Transaction was modified concurrently (expected version ${params.expectedVersion}, found ${existing.version})`,
    );
  }

  throw new Error(`Failed to update transaction ${params.id}`);
}

export async function voidTransactionInDb(params: {
  householdId: string;
  id: string;
  expectedVersion: number;
  voidReason?: string | null | undefined;
  voidedAt?: Date | undefined;
}): Promise<Transaction> {
  const [voided] = await getDb()
    .update(transactions)
    .set({
      voidedAt: params.voidedAt ?? new Date(),
      voidReason: params.voidReason?.trim() || null,
      version: params.expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.householdId, params.householdId),
        eq(transactions.id, params.id),
        eq(transactions.version, params.expectedVersion),
        isNull(transactions.voidedAt),
      ),
    )
    .returning();

  if (voided) {
    return mapRowToTransaction(voided);
  }

  const existing = await findTransactionById(params.householdId, params.id);
  if (!existing) {
    throw new TransactionNotFoundError(
      `Transaction ${params.id} not found in household`,
    );
  }
  if (existing.voidedAt !== null) {
    throw new TransactionAlreadyVoidedError(
      `Transaction ${params.id} is already voided`,
    );
  }
  if (existing.version !== params.expectedVersion) {
    throw new TransactionVersionConflictError(
      `Transaction was modified concurrently (expected version ${params.expectedVersion}, found ${existing.version})`,
    );
  }

  throw new Error(`Failed to void transaction ${params.id}`);
}

export type ListTransactionsParams = {
  householdId: string;
  accountId?: string | undefined;
  categoryId?: string | undefined;
  kind?: "expense" | "income" | "transfer" | undefined;
  type?: "expense" | "income" | "transfer" | undefined;
  month?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  search?: string | undefined;
  q?: string | undefined;
  status?: "active" | "voided" | "all" | undefined;
  includeVoided?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export function buildTransactionConditions(params: ListTransactionsParams) {
  const conditions = [eq(transactions.householdId, params.householdId)];

  if (params.status === "voided") {
    conditions.push(isNotNull(transactions.voidedAt));
  } else if (params.status === "all" || params.includeVoided) {
    // No voided condition
  } else {
    // Default: active only
    conditions.push(isNull(transactions.voidedAt));
  }

  const kind = params.kind ?? params.type;
  if (kind) {
    conditions.push(eq(transactions.kind, kind));
  }

  if (params.accountId) {
    conditions.push(
      or(
        eq(transactions.accountId, params.accountId),
        eq(transactions.fromAccountId, params.accountId),
        eq(transactions.toAccountId, params.accountId),
      )!,
    );
  }

  if (params.categoryId === "uncategorized") {
    conditions.push(
      and(
        or(eq(transactions.kind, "expense"), eq(transactions.kind, "income")),
        isNull(transactions.categoryId),
      )!,
    );
  } else if (params.categoryId) {
    conditions.push(eq(transactions.categoryId, params.categoryId));
  }

  let effectiveStartDate = params.startDate;
  let effectiveEndDate = params.endDate;

  if (params.month && !effectiveStartDate && !effectiveEndDate) {
    try {
      const { year, month } = parseMonthKey(params.month);
      const period = createMonthPeriod(year, month);
      effectiveStartDate = period.startDate;
      effectiveEndDate = period.endDate;
    } catch {
      // ignore invalid month
    }
  }

  if (params.from && !effectiveStartDate) {
    const match = params.from.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const y = Number.parseInt(match[1]!, 10);
      const m = Number.parseInt(match[2]!, 10);
      const d = Number.parseInt(match[3]!, 10);
      effectiveStartDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      effectiveStartDate = new Date(params.from);
    }
  }

  if (params.to && !effectiveEndDate) {
    const match = params.to.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const y = Number.parseInt(match[1]!, 10);
      const m = Number.parseInt(match[2]!, 10);
      const d = Number.parseInt(match[3]!, 10);
      effectiveEndDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    } else {
      effectiveEndDate = new Date(params.to);
    }
  }

  if (effectiveStartDate && !Number.isNaN(effectiveStartDate.getTime())) {
    conditions.push(gte(transactions.occurredOn, effectiveStartDate));
  }

  if (effectiveEndDate && !Number.isNaN(effectiveEndDate.getTime())) {
    conditions.push(lte(transactions.occurredOn, effectiveEndDate));
  }

  const search = (params.search ?? params.q)?.trim();
  if (search) {
    const escaped = search.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;
    conditions.push(
      or(
        ilike(transactions.payee, pattern),
        ilike(transactions.source, pattern),
        ilike(transactions.voidReason, pattern),
      )!,
    );
  }

  return conditions;
}

export async function queryTransactionsByHousehold(
  params: ListTransactionsParams,
): Promise<{ transactions: Transaction[]; total: number }> {
  const conditions = buildTransactionConditions(params);

  const [countResult] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(...conditions));
  const total = Number(countResult?.count ?? 0);

  let query = getDb()
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(
      desc(transactions.occurredOn),
      desc(transactions.createdAt),
      desc(transactions.id),
    );

  if (typeof params.limit === "number" && params.limit > 0) {
    query = query.limit(params.limit) as typeof query;
  }
  if (typeof params.offset === "number" && params.offset > 0) {
    query = query.offset(params.offset) as typeof query;
  }

  const rows = await query;
  return {
    transactions: rows.map(mapRowToTransaction),
    total,
  };
}

export async function countTransactionsByHousehold(
  params: ListTransactionsParams,
): Promise<number> {
  const conditions = buildTransactionConditions(params);
  const [result] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(...conditions));
  return Number(result?.count ?? 0);
}

export async function listTransactionsByHousehold(
  params: ListTransactionsParams,
): Promise<Transaction[]> {
  const result = await queryTransactionsByHousehold(params);
  return result.transactions;
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
