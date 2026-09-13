import {
  and,
  asc,
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
  createTransactionAuditSnapshot,
  createTransfer,
  householdId,
  money,
  parseMonthKey,
  personId,
  transactionId,
} from "@nodvis/finance-domain";
import type {
  Transaction,
  TransactionAuditSource,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { households } from "../schema/foundation";
import { liabilityRepayments } from "../schema/liabilities";
import { obligations } from "../schema/obligations";
import {
  transactionAuditEntries,
  transactions,
} from "../schema/transactions";
import { transactionSplitAllocations } from "../schema/transaction-splits";

export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransactionRow = typeof transactions.$inferInsert;
export type TransactionAuditRow = typeof transactionAuditEntries.$inferSelect;
export type NewTransactionAuditRow = typeof transactionAuditEntries.$inferInsert;

export type TransactionAuditActor = {
  authUserId?: string | null;
  personId?: string | null;
  source?: TransactionAuditSource;
};

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
      sourceNamespace:
        row.authoritativeId || row.sourceAccountId ? row.sourceNamespace : null,
      sourceAccountId: row.sourceAccountId || null,
      authoritativeId: row.authoritativeId,
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
      sourceNamespace:
        row.authoritativeId || row.sourceAccountId ? row.sourceNamespace : null,
      sourceAccountId: row.sourceAccountId || null,
      authoritativeId: row.authoritativeId,
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
      sourceNamespace:
        row.authoritativeId || row.sourceAccountId ? row.sourceNamespace : null,
      sourceAccountId: row.sourceAccountId || null,
      authoritativeId: row.authoritativeId,
    });
  }

  throw new Error(`Unknown transaction kind: ${(row as { kind: string }).kind}`);
}

export async function insertTransaction(
  tx: Transaction,
  options?: {
    submissionId?: string | undefined;
    audit?: TransactionAuditActor | undefined;
  },
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
    sourceNamespace: tx.sourceNamespace ?? "generic_csv",
    sourceAccountId: tx.sourceAccountId ?? "",
    authoritativeId: tx.authoritativeId ?? null,
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
    return await getDb().transaction(async (dbTx) => {
      const [inserted] = await dbTx
        .insert(transactions)
        .values(values)
        .returning();

      if (!inserted) {
        throw new Error("Failed to insert transaction");
      }

      const snapshot = createTransactionAuditSnapshot(tx);

      await dbTx.insert(transactionAuditEntries).values({
        transactionId: inserted.id,
        householdId: inserted.householdId,
        revision: inserted.version,
        operation: "create",
        source: options?.audit?.source ?? "manual",
        authUserId: options?.audit?.authUserId ?? null,
        personId: options?.audit?.personId ?? null,
        beforeState: null,
        afterState: snapshot,
        voidReason: null,
        recordedAt: inserted.createdAt,
      });

      return mapRowToTransaction(inserted);
    });
  } catch (error) {
    const pgError = (
      error && typeof error === "object" && "cause" in error && error.cause
        ? error.cause
        : error
    ) as { code?: string; detail?: string } | undefined;

    if (
      pgError &&
      typeof pgError === "object" &&
      "code" in pgError &&
      pgError.code === "23505" &&
      String(pgError.detail ?? "").includes("submission_id")
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
  audit?: TransactionAuditActor | undefined;
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

  return await getDb().transaction(async (dbTx) => {
    await dbTx.select({ id: households.id }).from(households)
      .where(eq(households.id, params.householdId)).for("update");
    const [existing] = await dbTx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, params.householdId),
          eq(transactions.id, params.id),
        ),
      )
      .limit(1);

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

    const [linkedRepayment] = await dbTx
      .select({ id: liabilityRepayments.id })
      .from(liabilityRepayments)
      .where(
        and(
          eq(liabilityRepayments.householdId, params.householdId),
          eq(liabilityRepayments.transactionId, params.id),
          isNull(liabilityRepayments.voidedAt),
        ),
      )
      .limit(1);

    const [linkedBnpl] = await dbTx
      .select({ id: bnplPurchases.id })
      .from(bnplPurchases)
      .where(
        and(
          eq(bnplPurchases.householdId, params.householdId),
          eq(bnplPurchases.transactionId, params.id),
          isNull(bnplPurchases.voidedAt),
        ),
      )
      .limit(1);

    const [linkedObligation] = await dbTx
      .select({ id: obligations.id })
      .from(obligations)
      .where(
        and(
          eq(obligations.householdId, params.householdId),
          eq(obligations.transactionId, params.id),
          isNull(obligations.cancelledAt),
        ),
      )
      .limit(1);

    if (linkedRepayment || linkedBnpl) {
      if (
        values.amountMinor !== existing.amountMinor ||
        values.currency !== existing.currency ||
        values.kind !== existing.kind
      ) {
        throw new TransactionVersionConflictError(
          "Cannot modify amount, currency, or kind of transaction linked to active repayment or BNPL purchase",
        );
      }
    }

    if (linkedObligation) {
      if (
        values.amountMinor !== existing.amountMinor ||
        values.currency !== existing.currency ||
        values.kind !== existing.kind
      ) {
        throw new TransactionVersionConflictError(
          "Cannot modify amount, currency, or kind of transaction linked to active obligation",
        );
      }
    }

    const existingSplitRows = await dbTx
      .select({
        categoryId: transactionSplitAllocations.categoryId,
        amountMinor: transactionSplitAllocations.amountMinor,
        currency: transactionSplitAllocations.currency,
      })
      .from(transactionSplitAllocations)
      .where(and(
        eq(transactionSplitAllocations.householdId, params.householdId),
        eq(transactionSplitAllocations.transactionId, params.id),
      ));
    const splitSnapshot = existingSplitRows.map((row) => ({
      categoryId: row.categoryId,
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
    }));

    if (values.amountMinor !== existing.amountMinor || values.currency !== existing.currency || values.kind !== existing.kind) {
      await dbTx.delete(transactionSplitAllocations).where(and(eq(transactionSplitAllocations.householdId, params.householdId), eq(transactionSplitAllocations.transactionId, params.id)));
    }

    const [updated] = await dbTx
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

    if (!updated) {
      throw new TransactionVersionConflictError(
        `Transaction was modified concurrently (expected version ${params.expectedVersion})`,
      );
    }

    const beforeSnapshot = createTransactionAuditSnapshot(mapRowToTransaction(existing), splitSnapshot);
    const afterSnapshot = createTransactionAuditSnapshot(
      params.transaction,
      values.amountMinor !== existing.amountMinor || values.currency !== existing.currency || values.kind !== existing.kind
        ? []
        : splitSnapshot,
    );

    await dbTx.insert(transactionAuditEntries).values({
      transactionId: updated.id,
      householdId: updated.householdId,
      revision: updated.version,
      operation: "correction",
      source: params.audit?.source ?? "manual",
      authUserId: params.audit?.authUserId ?? null,
      personId: params.audit?.personId ?? null,
      beforeState: beforeSnapshot,
      afterState: afterSnapshot,
      voidReason: null,
      recordedAt: updated.updatedAt,
    });

    return mapRowToTransaction(updated);
  });
}

export async function voidTransactionInDb(params: {
  householdId: string;
  id: string;
  expectedVersion: number;
  voidReason?: string | null | undefined;
  voidedAt?: Date | undefined;
  audit?: TransactionAuditActor | undefined;
}): Promise<Transaction> {
  const effectiveVoidedAt = params.voidedAt ?? new Date();
  const effectiveVoidReason = params.voidReason?.trim() || null;

  return await getDb().transaction(async (dbTx) => {
    await dbTx.select({ id: households.id }).from(households)
      .where(eq(households.id, params.householdId)).for("update");
    const [existing] = await dbTx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, params.householdId),
          eq(transactions.id, params.id),
        ),
      )
      .limit(1);

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

    const [linkedRepayment] = await dbTx
      .select({ id: liabilityRepayments.id })
      .from(liabilityRepayments)
      .where(
        and(
          eq(liabilityRepayments.householdId, params.householdId),
          eq(liabilityRepayments.transactionId, params.id),
          isNull(liabilityRepayments.voidedAt),
        ),
      )
      .limit(1);

    const [linkedBnpl] = await dbTx
      .select({ id: bnplPurchases.id })
      .from(bnplPurchases)
      .where(
        and(
          eq(bnplPurchases.householdId, params.householdId),
          eq(bnplPurchases.transactionId, params.id),
          isNull(bnplPurchases.voidedAt),
        ),
      )
      .limit(1);

    const [linkedObligation] = await dbTx
      .select({ id: obligations.id })
      .from(obligations)
      .where(
        and(
          eq(obligations.householdId, params.householdId),
          eq(obligations.transactionId, params.id),
          isNull(obligations.cancelledAt),
        ),
      )
      .limit(1);

    if (linkedRepayment || linkedBnpl) {
      throw new TransactionVersionConflictError(
        "Cannot void transaction linked to active repayment or BNPL purchase",
      );
    }

    if (linkedObligation) {
      throw new TransactionVersionConflictError(
        "Cannot void transaction linked to active obligation",
      );
    }

    const existingSplitRows = await dbTx
      .select({
        categoryId: transactionSplitAllocations.categoryId,
        amountMinor: transactionSplitAllocations.amountMinor,
        currency: transactionSplitAllocations.currency,
      })
      .from(transactionSplitAllocations)
      .where(and(
        eq(transactionSplitAllocations.householdId, params.householdId),
        eq(transactionSplitAllocations.transactionId, params.id),
      ));
    const splitSnapshot = existingSplitRows.map((row) => ({
      categoryId: row.categoryId,
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
    }));

    const [voided] = await dbTx
      .update(transactions)
      .set({
        voidedAt: effectiveVoidedAt,
        voidReason: effectiveVoidReason,
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

    if (!voided) {
      throw new TransactionVersionConflictError(
        `Transaction was modified concurrently (expected version ${params.expectedVersion})`,
      );
    }

    const beforeSnapshot = createTransactionAuditSnapshot(mapRowToTransaction(existing), splitSnapshot);
    const voidedTx = mapRowToTransaction(voided);
    const afterSnapshot = createTransactionAuditSnapshot(voidedTx, splitSnapshot);

    await dbTx.insert(transactionAuditEntries).values({
      transactionId: voided.id,
      householdId: voided.householdId,
      revision: voided.version,
      operation: "void",
      source: params.audit?.source ?? "manual",
      authUserId: params.audit?.authUserId ?? null,
      personId: params.audit?.personId ?? null,
      beforeState: beforeSnapshot,
      afterState: afterSnapshot,
      voidReason: effectiveVoidReason,
      recordedAt: voided.updatedAt,
    });

    return voidedTx;
  });
}

export async function listTransactionAuditEntries(
  householdId: string,
  transactionId: string,
): Promise<TransactionAuditRow[]> {
  return await getDb()
    .select()
    .from(transactionAuditEntries)
    .where(
      and(
        eq(transactionAuditEntries.householdId, householdId),
        eq(transactionAuditEntries.transactionId, transactionId),
      ),
    )
    .orderBy(asc(transactionAuditEntries.revision));
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
