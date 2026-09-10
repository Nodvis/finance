import { and, asc, desc, eq, gte, isNotNull, isNull, lte, lt, ne, or, sql } from "drizzle-orm";
import {
  createObligation,
  getDefaultObligationSortOrder,
  getObligationStatus,
  householdId as toHouseholdId,
  isObligationActive,
  isObligationHistory,
  money,
  obligationId as toObligationId,
  transactionId as toTransactionId,
  updateObligation,
  type ObligationScope,
  type ObligationStatus,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { households } from "../schema/foundation";
import { liabilityRepayments } from "../schema/liabilities";
import { obligations } from "../schema/obligations";
import { transactions } from "../schema/transactions";

export class ObligationNotFoundError extends Error {
  constructor(message: string = "Obligation not found in household") {
    super(message);
    this.name = "ObligationNotFoundError";
  }
}

export class ObligationVersionConflictError extends Error {
  constructor(message: string = "Obligation was modified concurrently") {
    super(message);
    this.name = "ObligationVersionConflictError";
  }
}

export class ObligationValidationError extends Error {
  constructor(message: string = "Obligation validation failed") {
    super(message);
    this.name = "ObligationValidationError";
  }
}

export class ObligationMatchConflictError extends Error {
  constructor(message: string = "Obligation matching conflict") {
    super(message);
    this.name = "ObligationMatchConflictError";
  }
}

type ObligationRow = typeof obligations.$inferSelect;

export type ObligationWithTransaction = {
  id: string;
  householdId: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  dueDate: string;
  notes: string | null;
  transactionId: string | null;
  version: number;
  status: ObligationStatus;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  matchedTransaction?: {
    id: string;
    payee: string | null;
    occurredOn: Date;
    amountMinor: bigint;
    currency: string;
  } | null;
};

export type SerializedObligation = {
  id: string;
  householdId: string;
  title: string;
  amountMinor: string;
  currency: string;
  dueDate: string;
  notes: string | null;
  transactionId: string | null;
  version: number;
  status: ObligationStatus;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  matchedTransaction?: {
    id: string;
    payee: string | null;
    occurredOn: string;
    amountMinor: string;
    currency: string;
  } | null;
};

export function serializeObligation(
  item: ObligationWithTransaction,
): SerializedObligation {
  return {
    ...item,
    amountMinor: item.amountMinor.toString(),
    cancelledAt: item.cancelledAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    matchedTransaction: item.matchedTransaction
      ? {
          ...item.matchedTransaction,
          amountMinor: item.matchedTransaction.amountMinor.toString(),
          occurredOn: item.matchedTransaction.occurredOn.toISOString(),
        }
      : null,
  };
}

function mapToObligationWithTransaction(
  row: ObligationRow,
  txRow?: {
    id: string;
    payee: string | null;
    occurredOn: Date;
    amountMinor: bigint;
    currency: string;
  } | null,
  todayStr: string = new Date().toISOString().slice(0, 10),
): ObligationWithTransaction {
  const status = getObligationStatus(
    {
      dueDate: row.dueDate,
      transactionId: row.transactionId ? toTransactionId(row.transactionId) : null,
      cancelledAt: row.cancelledAt,
    },
    todayStr,
  );

  return {
    id: row.id,
    householdId: row.householdId,
    title: row.title,
    amountMinor: row.amountMinor,
    currency: row.currency,
    dueDate: row.dueDate,
    notes: row.notes,
    transactionId: row.transactionId,
    version: row.version,
    status,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    matchedTransaction: txRow ?? null,
  };
}

export type ListObligationsOptions = {
  status?: ObligationStatus | "active" | "history" | "all" | undefined;
  scope?: ObligationScope | undefined;
  currency?: string | undefined;
  sortBy?: "dueDate" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  today?: string | undefined;
  dueFrom?: string | undefined;
  dueTo?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function listObligationsByHousehold(
  householdId: string,
  options?: ListObligationsOptions,
): Promise<ObligationWithTransaction[]> {
  const db = getDb();
  const todayStr = options?.today ?? new Date().toISOString().slice(0, 10);
  const filterStatus = options?.status ?? options?.scope ?? "all";
  const effectiveSortOrder =
    options?.sortOrder ?? getDefaultObligationSortOrder(filterStatus);

  const whereConditions = [eq(obligations.householdId, householdId)];

  if (options?.dueFrom) whereConditions.push(gte(obligations.dueDate, options.dueFrom));
  if (options?.dueTo) whereConditions.push(lte(obligations.dueDate, options.dueTo));

  if (options?.currency) {
    whereConditions.push(
      eq(obligations.currency, options.currency.trim().toUpperCase()),
    );
  }

  // SQL status pre-filtering
  if (filterStatus === "cancelled") {
    whereConditions.push(isNotNull(obligations.cancelledAt));
  } else if (filterStatus === "paid") {
    whereConditions.push(
      and(
        isNull(obligations.cancelledAt),
        isNotNull(obligations.transactionId),
      )!,
    );
  } else if (filterStatus === "active") {
    whereConditions.push(
      and(
        isNull(obligations.cancelledAt),
        isNull(obligations.transactionId),
      )!,
    );
  } else if (filterStatus === "history") {
    whereConditions.push(
      or(
        isNotNull(obligations.cancelledAt),
        isNotNull(obligations.transactionId),
      )!,
    );
  } else if (filterStatus === "upcoming") {
    whereConditions.push(
      and(
        isNull(obligations.cancelledAt),
        isNull(obligations.transactionId),
        gte(obligations.dueDate, todayStr),
      )!,
    );
  } else if (filterStatus === "overdue") {
    whereConditions.push(
      and(
        isNull(obligations.cancelledAt),
        isNull(obligations.transactionId),
        lt(obligations.dueDate, todayStr),
      )!,
    );
  }

  const orderClauses =
    effectiveSortOrder === "desc"
      ? [desc(obligations.dueDate), desc(obligations.id)]
      : [asc(obligations.dueDate), asc(obligations.id)];

  let query = db
    .select({
      obligation: obligations,
      txId: transactions.id,
      txPayee: transactions.payee,
      txOccurredOn: transactions.occurredOn,
      txAmountMinor: transactions.amountMinor,
      txCurrency: transactions.currency,
    })
    .from(obligations)
    .leftJoin(
      transactions,
      and(
        eq(obligations.transactionId, transactions.id),
        eq(transactions.householdId, householdId),
      ),
    )
    .where(and(...whereConditions))
    .orderBy(...orderClauses);

  if (typeof options?.limit === "number" && options.limit > 0) {
    query = query.limit(options.limit) as typeof query;
  }
  if (typeof options?.offset === "number" && options.offset > 0) {
    query = query.offset(options.offset) as typeof query;
  }

  const rows = await query;

  const items = rows.map((r) =>
    mapToObligationWithTransaction(
      r.obligation,
      r.txId
        ? {
            id: r.txId,
            payee: r.txPayee,
            occurredOn: r.txOccurredOn!,
            amountMinor: r.txAmountMinor!,
            currency: r.txCurrency!,
          }
        : null,
      todayStr,
    ),
  );

  // In-memory verification filter to ensure domain status parity
  if (filterStatus === "all") {
    return items;
  }
  if (filterStatus === "active") {
    return items.filter((item) => isObligationActive(item.status));
  }
  if (filterStatus === "history") {
    return items.filter((item) => isObligationHistory(item.status));
  }
  return items.filter((item) => item.status === filterStatus);
}

export async function getObligationById(
  householdId: string,
  obligationId: string,
  today?: string,
): Promise<ObligationWithTransaction> {
  const db = getDb();
  const todayStr = today ?? new Date().toISOString().slice(0, 10);

  const [row] = await db
    .select({
      obligation: obligations,
      txId: transactions.id,
      txPayee: transactions.payee,
      txOccurredOn: transactions.occurredOn,
      txAmountMinor: transactions.amountMinor,
      txCurrency: transactions.currency,
    })
    .from(obligations)
    .leftJoin(
      transactions,
      and(
        eq(obligations.transactionId, transactions.id),
        eq(transactions.householdId, householdId),
      ),
    )
    .where(
      and(
        eq(obligations.householdId, householdId),
        eq(obligations.id, obligationId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ObligationNotFoundError(
      `Obligation ${obligationId} not found in household ${householdId}`,
    );
  }

  return mapToObligationWithTransaction(
    row.obligation,
    row.txId
      ? {
          id: row.txId,
          payee: row.txPayee,
          occurredOn: row.txOccurredOn!,
          amountMinor: row.txAmountMinor!,
          currency: row.txCurrency!,
        }
      : null,
    todayStr,
  );
}

export async function createObligationInDb(
  householdId: string,
  input: {
    title: string;
    amountMinor: bigint;
    currency: string;
    dueDate: string;
    notes?: string | null | undefined;
  },
): Promise<ObligationWithTransaction> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    // Validate using domain
    const domainEntity = createObligation({
      householdId: toHouseholdId(householdId),
      title: input.title,
      amount: money(input.amountMinor, input.currency),
      dueDate: input.dueDate,
      notes: input.notes,
    });

    const [inserted] = await dbTx
      .insert(obligations)
      .values({
        id: domainEntity.id,
        householdId,
        title: domainEntity.title,
        amountMinor: domainEntity.amount.amountMinor,
        currency: domainEntity.amount.currency,
        dueDate: domainEntity.dueDate,
        notes: domainEntity.notes,
        transactionId: null,
        version: 1,
        cancelledAt: null,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert obligation");
    }

    return mapToObligationWithTransaction(inserted, null);
  });
}

export async function updateObligationInDb(
  householdId: string,
  obligationId: string,
  expectedVersion: number,
  input: {
    title?: string | undefined;
    amountMinor?: bigint | undefined;
    currency?: string | undefined;
    dueDate?: string | undefined;
    notes?: string | null | undefined;
  },
): Promise<ObligationWithTransaction> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select()
      .from(obligations)
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
        ),
      )
      .for("update");

    if (!existing) {
      throw new ObligationNotFoundError(
        `Obligation ${obligationId} not found in household ${householdId}`,
      );
    }
    if (existing.version !== expectedVersion) {
      throw new ObligationVersionConflictError(
        `Obligation version mismatch (expected ${expectedVersion}, found ${existing.version})`,
      );
    }
    if (existing.cancelledAt !== null) {
      throw new ObligationValidationError("Cannot update cancelled obligation");
    }

    // If matched, amount and currency cannot be changed
    if (existing.transactionId !== null) {
      if (
        (input.amountMinor !== undefined &&
          input.amountMinor !== existing.amountMinor) ||
        (input.currency !== undefined &&
          input.currency !== existing.currency)
      ) {
        throw new ObligationValidationError(
          "Cannot modify amount or currency of matched obligation. Unlink first.",
        );
      }
    }

    const domainExisting = {
      id: toObligationId(existing.id),
      householdId: toHouseholdId(existing.householdId),
      title: existing.title,
      amount: money(existing.amountMinor, existing.currency),
      dueDate: existing.dueDate,
      notes: existing.notes,
      transactionId: existing.transactionId
        ? toTransactionId(existing.transactionId)
        : null,
      version: existing.version,
      cancelledAt: existing.cancelledAt,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };

    const domainUpdated = updateObligation(domainExisting, {
      title: input.title,
      amount:
        input.amountMinor !== undefined
          ? money(input.amountMinor, input.currency ?? existing.currency)
          : undefined,
      dueDate: input.dueDate,
      notes: input.notes,
    });

    const [updated] = await dbTx
      .update(obligations)
      .set({
        title: domainUpdated.title,
        amountMinor: domainUpdated.amount.amountMinor,
        currency: domainUpdated.amount.currency,
        dueDate: domainUpdated.dueDate,
        notes: domainUpdated.notes,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
          eq(obligations.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new ObligationVersionConflictError();
    }

    return mapToObligationWithTransaction(updated, null);
  });
}

export async function cancelObligationInDb(
  householdId: string,
  obligationId: string,
  expectedVersion: number,
): Promise<ObligationWithTransaction> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [existing] = await dbTx
      .select()
      .from(obligations)
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
        ),
      )
      .for("update");

    if (!existing) {
      throw new ObligationNotFoundError(
        `Obligation ${obligationId} not found in household ${householdId}`,
      );
    }
    if (existing.version !== expectedVersion) {
      throw new ObligationVersionConflictError(
        `Obligation version mismatch (expected ${expectedVersion}, found ${existing.version})`,
      );
    }
    if (existing.cancelledAt !== null) {
      throw new ObligationValidationError("Obligation is already cancelled");
    }
    if (existing.transactionId !== null) {
      throw new ObligationValidationError(
        "Cannot cancel matched obligation. Unlink the transaction first.",
      );
    }

    const [cancelled] = await dbTx
      .update(obligations)
      .set({
        cancelledAt: new Date(),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
          eq(obligations.version, expectedVersion),
        ),
      )
      .returning();

    if (!cancelled) {
      throw new ObligationVersionConflictError();
    }

    return mapToObligationWithTransaction(cancelled, null);
  });
}

export async function matchObligationInDb(
  householdId: string,
  obligationId: string,
  expectedVersion: number,
  txId: string,
): Promise<ObligationWithTransaction> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [obligation] = await dbTx
      .select()
      .from(obligations)
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
        ),
      )
      .for("update");

    if (!obligation) {
      throw new ObligationNotFoundError(
        `Obligation ${obligationId} not found in household ${householdId}`,
      );
    }
    if (obligation.version !== expectedVersion) {
      throw new ObligationVersionConflictError(
        `Obligation version mismatch (expected ${expectedVersion}, found ${obligation.version})`,
      );
    }
    if (obligation.cancelledAt !== null) {
      throw new ObligationMatchConflictError(
        "Cannot match a cancelled obligation",
      );
    }
    if (obligation.transactionId !== null) {
      throw new ObligationMatchConflictError(
        "Obligation is already matched to a transaction",
      );
    }

    // Fetch transaction
    const [tx] = await dbTx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.id, txId),
        ),
      )
      .for("update");

    if (!tx) {
      throw new ObligationMatchConflictError(
        "Matching requires transaction in the same household",
      );
    }
    if (tx.voidedAt !== null) {
      throw new ObligationMatchConflictError(
        "Matching requires an active transaction",
      );
    }
    if (tx.kind !== "expense") {
      throw new ObligationMatchConflictError(
        "Matching requires transaction of kind expense only",
      );
    }
    if (tx.currency !== obligation.currency) {
      throw new ObligationMatchConflictError(
        "Matching requires exact currency match",
      );
    }
    if (tx.amountMinor !== obligation.amountMinor) {
      throw new ObligationMatchConflictError(
        "Matching requires exact amount match",
      );
    }

    // Check transaction conflict against other active obligations
    const [existingObligationLink] = await dbTx
      .select({ id: obligations.id })
      .from(obligations)
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.transactionId, txId),
          isNull(obligations.cancelledAt),
          ne(obligations.id, obligationId),
        ),
      )
      .limit(1);

    if (existingObligationLink) {
      throw new ObligationMatchConflictError(
        "Transaction is already matched to another active obligation",
      );
    }

    // Check transaction conflict against active liability repayments
    const [existingRepaymentLink] = await dbTx
      .select({ id: liabilityRepayments.id })
      .from(liabilityRepayments)
      .where(
        and(
          eq(liabilityRepayments.householdId, householdId),
          eq(liabilityRepayments.transactionId, txId),
          isNull(liabilityRepayments.voidedAt),
        ),
      )
      .limit(1);

    if (existingRepaymentLink) {
      throw new ObligationMatchConflictError(
        "Transaction is already linked to an active liability repayment",
      );
    }

    // Check transaction conflict against active BNPL purchases
    const [existingBnplLink] = await dbTx
      .select({ id: bnplPurchases.id })
      .from(bnplPurchases)
      .where(
        and(
          eq(bnplPurchases.householdId, householdId),
          eq(bnplPurchases.transactionId, txId),
          isNull(bnplPurchases.voidedAt),
        ),
      )
      .limit(1);

    if (existingBnplLink) {
      throw new ObligationMatchConflictError(
        "Transaction is already linked to an active BNPL purchase",
      );
    }

    const [matched] = await dbTx
      .update(obligations)
      .set({
        transactionId: tx.id,
        version: obligation.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
          eq(obligations.version, expectedVersion),
        ),
      )
      .returning();

    if (!matched) {
      throw new ObligationVersionConflictError();
    }

    return mapToObligationWithTransaction(matched, {
      id: tx.id,
      payee: tx.payee,
      occurredOn: tx.occurredOn,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
    });
  });
}

export async function unlinkObligationInDb(
  householdId: string,
  obligationId: string,
  expectedVersion: number,
): Promise<ObligationWithTransaction> {
  return await getDb().transaction(async (dbTx) => {
    // Acquire household serialization lock
    await dbTx
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId))
      .for("update");

    const [obligation] = await dbTx
      .select()
      .from(obligations)
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
        ),
      )
      .for("update");

    if (!obligation) {
      throw new ObligationNotFoundError(
        `Obligation ${obligationId} not found in household ${householdId}`,
      );
    }
    if (obligation.version !== expectedVersion) {
      throw new ObligationVersionConflictError(
        `Obligation version mismatch (expected ${expectedVersion}, found ${obligation.version})`,
      );
    }
    if (obligation.cancelledAt !== null) {
      throw new ObligationValidationError(
        "Cannot unlink a cancelled obligation",
      );
    }
    if (obligation.transactionId === null) {
      throw new ObligationValidationError(
        "Obligation is not matched to any transaction",
      );
    }

    // Verify linked transaction is active
    const [tx] = await dbTx
      .select({ id: transactions.id, voidedAt: transactions.voidedAt })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.id, obligation.transactionId),
        ),
      )
      .limit(1);

    if (tx && tx.voidedAt !== null) {
      throw new ObligationValidationError(
        "Unlink is supported only for active obligation and active linked transaction",
      );
    }

    const [unlinked] = await dbTx
      .update(obligations)
      .set({
        transactionId: null,
        version: obligation.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(obligations.householdId, householdId),
          eq(obligations.id, obligationId),
          eq(obligations.version, expectedVersion),
        ),
      )
      .returning();

    if (!unlinked) {
      throw new ObligationVersionConflictError();
    }

    return mapToObligationWithTransaction(unlinked, null);
  });
}

export async function listCandidateTransactionsForObligation(
  householdId: string,
  obligationId: string,
): Promise<
  Array<{
    id: string;
    payee: string | null;
    occurredOn: Date;
    amountMinor: bigint;
    currency: string;
  }>
> {
  const db = getDb();
  const obligation = await getObligationById(householdId, obligationId);

  // Subqueries for already linked transactions
  const linkedObligations = db
    .select({ txId: obligations.transactionId })
    .from(obligations)
    .where(
      and(
        eq(obligations.householdId, householdId),
        isNotNull(obligations.transactionId),
        isNull(obligations.cancelledAt),
      ),
    );

  const linkedRepayments = db
    .select({ txId: liabilityRepayments.transactionId })
    .from(liabilityRepayments)
    .where(
      and(
        eq(liabilityRepayments.householdId, householdId),
        isNotNull(liabilityRepayments.transactionId),
        isNull(liabilityRepayments.voidedAt),
      ),
    );

  const linkedBnpl = db
    .select({ txId: bnplPurchases.transactionId })
    .from(bnplPurchases)
    .where(
      and(
        eq(bnplPurchases.householdId, householdId),
        isNotNull(bnplPurchases.transactionId),
        isNull(bnplPurchases.voidedAt),
      ),
    );

  const candidates = await db
    .select({
      id: transactions.id,
      payee: transactions.payee,
      occurredOn: transactions.occurredOn,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        isNull(transactions.voidedAt),
        eq(transactions.kind, "expense"),
        eq(transactions.currency, obligation.currency),
        eq(transactions.amountMinor, obligation.amountMinor),
        sql`${transactions.id} NOT IN (${linkedObligations})`,
        sql`${transactions.id} NOT IN (${linkedRepayments})`,
        sql`${transactions.id} NOT IN (${linkedBnpl})`,
      ),
    )
    .orderBy(desc(transactions.occurredOn), desc(transactions.id));

  return candidates;
}

export type UpcomingObligationsSummary = {
  upcomingCount: number;
  overdueCount: number;
  paidCount: number;
  upcomingByCurrency: Array<{
    currency: string;
    totalMinor: bigint;
  }>;
  overdueByCurrency: Array<{
    currency: string;
    totalMinor: bigint;
  }>;
};

export async function getUpcomingObligationsSummary(
  householdId: string,
  today?: string | undefined,
): Promise<UpcomingObligationsSummary> {
  const db = getDb();
  const todayStr = today ?? new Date().toISOString().slice(0, 10);

  const activeRows = await db
    .select({
      amountMinor: obligations.amountMinor,
      currency: obligations.currency,
      dueDate: obligations.dueDate,
      transactionId: obligations.transactionId,
    })
    .from(obligations)
    .where(
      and(
        eq(obligations.householdId, householdId),
        isNull(obligations.cancelledAt),
      ),
    );

  let upcomingCount = 0;
  let overdueCount = 0;
  let paidCount = 0;

  const upcomingMap = new Map<string, bigint>();
  const overdueMap = new Map<string, bigint>();

  for (const row of activeRows) {
    if (row.transactionId !== null) {
      paidCount++;
    } else if (row.dueDate >= todayStr) {
      upcomingCount++;
      upcomingMap.set(
        row.currency,
        (upcomingMap.get(row.currency) ?? 0n) + row.amountMinor,
      );
    } else {
      overdueCount++;
      overdueMap.set(
        row.currency,
        (overdueMap.get(row.currency) ?? 0n) + row.amountMinor,
      );
    }
  }

  const upcomingByCurrency = Array.from(upcomingMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, totalMinor]) => ({ currency, totalMinor }));

  const overdueByCurrency = Array.from(overdueMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, totalMinor]) => ({ currency, totalMinor }));

  return {
    upcomingCount,
    overdueCount,
    paidCount,
    upcomingByCurrency,
    overdueByCurrency,
  };
}
