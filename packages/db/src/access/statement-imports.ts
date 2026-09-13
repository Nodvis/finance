import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  accountId as toAccountId,
  createExpense,
  createIncome,
  createTransactionAuditSnapshot,
  encodeImportIdentityParts,
  householdId as toHouseholdId,
  isSafeToAutoCommitRow,
  money,
  personId as toPersonId,
  transactionId as toTransactionId,
  type PossibleManualMatch,
  type StatementImportBatchStatus,
  type StatementImportAmbiguityState,
  type StatementImportMappingConfig,
  type StatementImportRowKind,
  type StatementImportRowStatus,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import {
  statementImportBatches,
  statementImportRows,
} from "../schema/statement-imports";
import {
  transactionAuditEntries,
  transactions,
} from "../schema/transactions";

export type StatementImportBatchRow =
  typeof statementImportBatches.$inferSelect;
export type NewStatementImportBatchRow =
  typeof statementImportBatches.$inferInsert;
export type StatementImportRowRecord = typeof statementImportRows.$inferSelect;
export type NewStatementImportRowRecord =
  typeof statementImportRows.$inferInsert;

export class ImportBatchNotFoundError extends Error {
  constructor(message: string = "Import batch not found") {
    super(message);
    this.name = "ImportBatchNotFoundError";
  }
}

export class ImportBatchAlreadyCommittedError extends Error {
  constructor(message: string = "Import batch has already been committed") {
    super(message);
    this.name = "ImportBatchAlreadyCommittedError";
  }
}

export class DuplicateImportRowError extends Error {
  constructor(message: string = "Row has already been imported for this account") {
    super(message);
    this.name = "DuplicateImportRowError";
  }
}

export class AmbiguousImportRowCommitError extends Error {
  constructor(
    message: string = "Cannot commit ambiguous import row without explicit resolution",
  ) {
    super(message);
    this.name = "AmbiguousImportRowCommitError";
  }
}

export async function createStatementImportBatchInDb(params: {
  batch: NewStatementImportBatchRow;
  rows: NewStatementImportRowRecord[];
}): Promise<{ batchId: string }> {
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [insertedBatch] = await tx
      .insert(statementImportBatches)
      .values(params.batch)
      .returning({ id: statementImportBatches.id });

    if (!insertedBatch) {
      throw new Error("Failed to insert statement import batch");
    }

    if (params.rows.length > 0) {
      const rowsWithBatchId = params.rows.map((r) => ({
        ...r,
        batchId: insertedBatch.id,
      }));

      // Bounded chunked insert to stay well within PostgreSQL parameter limits
      const chunkSize = 100;
      for (let i = 0; i < rowsWithBatchId.length; i += chunkSize) {
        const chunk = rowsWithBatchId.slice(i, i + chunkSize);
        await tx.insert(statementImportRows).values(chunk);
      }
    }

    return { batchId: insertedBatch.id };
  });
}

export async function findStatementImportBatchById(
  householdId: string,
  batchId: string,
  accountId?: string,
): Promise<StatementImportBatchRow | null> {
  const [found] = await getDb()
    .select()
    .from(statementImportBatches)
    .where(
      and(
        eq(statementImportBatches.householdId, householdId),
        eq(statementImportBatches.id, batchId),
        ...(accountId ? [eq(statementImportBatches.accountId, accountId)] : []),
      ),
    )
    .limit(1);

  return found ?? null;
}

export async function listStatementImportRowsByBatch(
  householdId: string,
  batchId: string,
  accountId?: string,
): Promise<StatementImportRowRecord[]> {
  return await getDb()
    .select()
    .from(statementImportRows)
    .where(
      and(
        eq(statementImportRows.householdId, householdId),
        eq(statementImportRows.batchId, batchId),
        ...(accountId ? [eq(statementImportRows.accountId, accountId)] : []),
      ),
    )
    .orderBy(asc(statementImportRows.rowIndex));
}

export async function listStatementImportBatchesByAccount(
  householdId: string,
  accountId: string,
): Promise<StatementImportBatchRow[]> {
  return await getDb()
    .select()
    .from(statementImportBatches)
    .where(
      and(
        eq(statementImportBatches.householdId, householdId),
        eq(statementImportBatches.accountId, accountId),
      ),
    )
    .orderBy(desc(statementImportBatches.createdAt));
}

export async function findExistingImportDedupeHashes(
  accountId: string,
  dedupeHashes: string[],
  scope?: { sourceNamespace?: string; sourceAccountIds?: string[] },
): Promise<Set<string>> {
  if (dedupeHashes.length === 0) {
    return new Set();
  }

  const existing = new Set<string>();
  const chunkSize = 200;
  const sourceNamespace = scope?.sourceNamespace?.trim();
  const sourceAccountIds = scope?.sourceAccountIds?.map(normalizeSourceAccountId).filter(Boolean) ?? [];
  const sourceScopeCondition = sourceNamespace
    ? or(
      and(
        sql`trim(${statementImportRows.sourceNamespace}) = ${sourceNamespace}`,
        sourceAccountIds.length > 0 ? inArray(sql`trim(${statementImportRows.sourceAccountId})`, sourceAccountIds) : or(sql`trim(${statementImportRows.sourceAccountId}) = ''`, isNull(statementImportRows.sourceAccountId)),
      ),
      and(
        or(sql`trim(${statementImportRows.sourceNamespace}) = ''`, isNull(statementImportRows.sourceNamespace)),
        or(sql`trim(${statementImportRows.sourceAccountId}) = ''`, isNull(statementImportRows.sourceAccountId)),
      ),
    )
    : undefined;

  for (let i = 0; i < dedupeHashes.length; i += chunkSize) {
    const chunk = dedupeHashes.slice(i, i + chunkSize);
    const rows = await getDb()
      .select({ dedupeHash: statementImportRows.dedupeHash })
      .from(statementImportRows)
      .where(
        and(
          eq(statementImportRows.accountId, accountId),
          eq(statementImportRows.status, "imported"),
          ...(sourceScopeCondition ? [sourceScopeCondition] : []),
          inArray(statementImportRows.dedupeHash, chunk),
        ),
      );

    for (const r of rows) {
      existing.add(r.dedupeHash);
    }
  }

  return existing;
}

export type ExistingAuthoritativeRecord = {
  authoritativeId: string;
  ambiguityState?: StatementImportAmbiguityState;
  transaction: {
    id: string;
    voidedAt: Date | null;
    payee: string | null;
    source: string | null;
    amountMinor: bigint;
    currency: string;
    version: number;
  };
  importRow?: {
    id: string;
    batchId: string;
  } | undefined;
};

function normalizeSourceAccountId(sourceAccountId: string | null | undefined): string {
  return sourceAccountId?.trim() || "";
}

function normalizeSourceNamespace(sourceNamespace: string | null | undefined): string {
  return sourceNamespace?.trim() || "";
}

function dedupScopeKey(sourceNamespace: string | null | undefined, sourceAccountId: string | null | undefined, identity: string): string {
  return encodeImportIdentityParts([
    normalizeSourceNamespace(sourceNamespace),
    normalizeSourceAccountId(sourceAccountId),
    identity,
  ]);
}

export async function findExistingAuthoritativeRecordsInDb(params: {
  householdId: string;
  accountId: string;
  sourceNamespace: string;
  sourceAccountId?: string | null;
  sourceAccountIds?: string[];
  authoritativeIds: string[];
}): Promise<Map<string, ExistingAuthoritativeRecord>> {
  const result = new Map<string, ExistingAuthoritativeRecord>();
  const recordsByKey = new Map<string, ExistingAuthoritativeRecord[]>();
  if (params.authoritativeIds.length === 0) return result;

  const db = getDb();
  const sourceNamespace = normalizeSourceNamespace(params.sourceNamespace);
  const sourceAccountIds = (params.sourceAccountIds ?? (params.sourceAccountId ? [params.sourceAccountId] : []))
    .map(normalizeSourceAccountId)
    .filter(Boolean);
  const sourceAccountCondition = sourceAccountIds.length > 0
    ? inArray(sql`trim(${transactions.sourceAccountId})`, sourceAccountIds)
    : or(sql`trim(${transactions.sourceAccountId}) = ''`, isNull(transactions.sourceAccountId));
  const sourceAccountConditionForRows = sourceAccountIds.length > 0
    ? inArray(sql`trim(${statementImportRows.sourceAccountId})`, sourceAccountIds)
    : or(sql`trim(${statementImportRows.sourceAccountId}) = ''`, isNull(statementImportRows.sourceAccountId));
  const sourceScopeCondition = or(
    and(sql`trim(${transactions.sourceNamespace}) = ${sourceNamespace}`, sourceAccountCondition),
    and(
      or(sql`trim(${transactions.sourceNamespace}) = ''`, isNull(transactions.sourceNamespace)),
      or(sql`trim(${transactions.sourceAccountId}) = ''`, isNull(transactions.sourceAccountId)),
    ),
  );
  const sourceScopeConditionForRows = or(
    and(sql`trim(${statementImportRows.sourceNamespace}) = ${sourceNamespace}`, sourceAccountConditionForRows),
    and(
      or(sql`trim(${statementImportRows.sourceNamespace}) = ''`, isNull(statementImportRows.sourceNamespace)),
      or(sql`trim(${statementImportRows.sourceAccountId}) = ''`, isNull(statementImportRows.sourceAccountId)),
    ),
  );

  // Query transactions matching authoritative ID within this household, account, namespace, sourceAccount
  const txRows = await db
    .select({
      id: transactions.id,
      sourceNamespace: transactions.sourceNamespace,
      sourceAccountId: transactions.sourceAccountId,
      authoritativeId: transactions.authoritativeId,
      voidedAt: transactions.voidedAt,
      payee: transactions.payee,
      source: transactions.source,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      version: transactions.version,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, params.householdId),
        eq(transactions.accountId, params.accountId),
        sourceScopeCondition,
        inArray(transactions.authoritativeId, params.authoritativeIds),
      ),
    );

  for (const tx of txRows) {
    if (tx.authoritativeId) {
      const key = dedupScopeKey(tx.sourceNamespace, tx.sourceAccountId, tx.authoritativeId);
      const record: ExistingAuthoritativeRecord = {
        authoritativeId: tx.authoritativeId,
        transaction: {
          id: tx.id,
          voidedAt: tx.voidedAt,
          payee: tx.payee,
          source: tx.source,
          amountMinor: tx.amountMinor,
          currency: tx.currency,
          version: tx.version,
        },
      };
      const records = recordsByKey.get(key) ?? [];
      records.push(record);
      recordsByKey.set(key, records);
    }
  }

  for (const [key, records] of recordsByKey) {
    if (records.length === 1) {
      result.set(key, records[0]!);
    } else if (records.length > 1) {
      // Preserve the key and fail closed. Dropping it makes the caller treat
      // an existing authoritative ID as a new transaction.
      result.set(key, {
        ...records[0]!,
        ambiguityState: "ambiguous",
        importRow: undefined,
      });
    }
  }

  // Also query statement_import_rows with status = 'imported' for this account
  const importRows = await db
    .select({
      id: statementImportRows.id,
      batchId: statementImportRows.batchId,
      sourceNamespace: statementImportRows.sourceNamespace,
      sourceAccountId: statementImportRows.sourceAccountId,
      authoritativeId: statementImportRows.authoritativeId,
      canonicalTransactionId: statementImportRows.canonicalTransactionId,
      committedTransactionId: statementImportRows.committedTransactionId,
    })
    .from(statementImportRows)
    .where(
      and(
        eq(statementImportRows.householdId, params.householdId),
        eq(statementImportRows.accountId, params.accountId),
        eq(statementImportRows.status, "imported"),
        sourceScopeConditionForRows,
        inArray(statementImportRows.authoritativeId, params.authoritativeIds),
      ),
    );

  for (const ir of importRows) {
    if (ir.authoritativeId) {
      const existing = result.get(dedupScopeKey(ir.sourceNamespace, ir.sourceAccountId, ir.authoritativeId));
      if (existing) {
        existing.importRow = { id: ir.id, batchId: ir.batchId };
      }
    }
  }

  return result;
}

export type ExistingFallbackRecord = {
  importRowId: string;
  batchId: string;
  fallbackIdentifier: string;
  sourceNamespace: string | null;
  sourceAccountId: string | null;
  occurrenceIndex: number;
  canonicalTransactionId: string | null;
  voidedAt: Date | null;
};

export async function findExistingFallbackRecordsInDb(params: {
  householdId: string;
  accountId: string;
  fallbackIdentifiers: string[];
  sourceNamespace?: string;
  sourceAccountIds?: string[];
}): Promise<Map<string, ExistingFallbackRecord[]>> {
  const result = new Map<string, ExistingFallbackRecord[]>();
  if (params.fallbackIdentifiers.length === 0) return result;

  const db = getDb();
  const sourceNamespace = params.sourceNamespace?.trim();
  const sourceAccountIds = params.sourceAccountIds?.map(normalizeSourceAccountId).filter(Boolean);
  const rows = await db
    .select({
      id: statementImportRows.id,
      batchId: statementImportRows.batchId,
      fallbackIdentifier: statementImportRows.fallbackIdentifier,
      sourceNamespace: statementImportRows.sourceNamespace,
      sourceAccountId: statementImportRows.sourceAccountId,
      occurrenceIndex: statementImportRows.occurrenceIndex,
      canonicalTransactionId: statementImportRows.canonicalTransactionId,
      committedTransactionId: statementImportRows.committedTransactionId,
      txVoidedAt: transactions.voidedAt,
    })
    .from(statementImportRows)
    .leftJoin(
      transactions,
      eq(
        transactions.id,
        sql`COALESCE(${statementImportRows.canonicalTransactionId}, ${statementImportRows.committedTransactionId})`,
      ),
    )
    .where(
      and(
        eq(statementImportRows.householdId, params.householdId),
        eq(statementImportRows.accountId, params.accountId),
        eq(statementImportRows.status, "imported"),
        ...(sourceNamespace ? [or(
          and(
            sql`trim(${statementImportRows.sourceNamespace}) = ${sourceNamespace}`,
            sourceAccountIds?.length ? inArray(sql`trim(${statementImportRows.sourceAccountId})`, sourceAccountIds) : or(sql`trim(${statementImportRows.sourceAccountId}) = ''`, isNull(statementImportRows.sourceAccountId)),
          ),
          and(
            or(sql`trim(${statementImportRows.sourceNamespace}) = ''`, isNull(statementImportRows.sourceNamespace)),
            or(sql`trim(${statementImportRows.sourceAccountId}) = ''`, isNull(statementImportRows.sourceAccountId)),
          ),
        )] : []),
        inArray(statementImportRows.fallbackIdentifier, params.fallbackIdentifiers),
      ),
    )
    .orderBy(asc(statementImportRows.occurrenceIndex));

  for (const r of rows) {
    if (r.fallbackIdentifier) {
      const key = dedupScopeKey(r.sourceNamespace, r.sourceAccountId, r.fallbackIdentifier);
      const list = result.get(key) ?? [];
      list.push({
        importRowId: r.id,
        batchId: r.batchId,
        fallbackIdentifier: r.fallbackIdentifier,
        sourceNamespace: r.sourceNamespace,
        sourceAccountId: r.sourceAccountId,
        occurrenceIndex: r.occurrenceIndex,
        canonicalTransactionId:
          r.canonicalTransactionId ?? r.committedTransactionId ?? null,
        voidedAt: r.txVoidedAt ?? null,
      });
      result.set(key, list);
    }
  }

  return result;
}

export async function findPossibleManualMatchesInDb(params: {
  householdId: string;
  accountId: string;
  candidates: Array<{
    rowIndex: number;
    occurredOn: Date;
    amountMinor: bigint;
    currency: string;
    kind: "expense" | "income";
  }>;
}): Promise<Map<number, PossibleManualMatch>> {
  const matches = new Map<number, PossibleManualMatch>();
  if (params.candidates.length === 0) {
    return matches;
  }

  // Find min and max dates across candidates with 1-day buffer
  let minDate = params.candidates[0]!.occurredOn;
  let maxDate = params.candidates[0]!.occurredOn;
  for (const c of params.candidates) {
    if (c.occurredOn < minDate) minDate = c.occurredOn;
    if (c.occurredOn > maxDate) maxDate = c.occurredOn;
  }

  const rangeStart = new Date(minDate.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(maxDate.getTime() + 24 * 60 * 60 * 1000);

  const existingTxs = await getDb()
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      occurredOn: transactions.occurredOn,
      payee: transactions.payee,
      source: transactions.source,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, params.householdId),
        eq(transactions.accountId, params.accountId),
        isNull(transactions.voidedAt),
        gte(transactions.occurredOn, rangeStart),
        lte(transactions.occurredOn, rangeEnd),
      ),
    );

  if (existingTxs.length === 0) {
    return matches;
  }

  for (const cand of params.candidates) {
    const candDateMs = cand.occurredOn.getTime();
    const matchedTx = existingTxs.find((tx) => {
      if (tx.kind !== cand.kind) return false;
      if (tx.currency !== cand.currency) return false;
      if (tx.amountMinor !== cand.amountMinor) return false;
      // Within 24 hours
      const diffMs = Math.abs(tx.occurredOn.getTime() - candDateMs);
      return diffMs <= 24 * 60 * 60 * 1000;
    });

    if (matchedTx) {
      matches.set(cand.rowIndex, {
        transactionId: matchedTx.id,
        description: matchedTx.payee ?? matchedTx.source ?? "Transaction",
        occurredOn: matchedTx.occurredOn.toISOString(),
        amountMinor: matchedTx.amountMinor.toString(),
        currency: matchedTx.currency,
        kind: matchedTx.kind,
      });
    }
  }

  return matches;
}

export async function commitStatementImportBatchInDb(params: {
  householdId: string;
  batchId: string;
  accountId: string;
  selectedRowIndices?: number[] | undefined;
  safeOnly?: boolean | undefined;
  authUserId?: string | null | undefined;
  personId: string;
}): Promise<{
  batchId: string;
  importedCount: number;
  skippedCount: number;
  committedTransactionIds: string[];
}> {
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock and fetch the batch to prevent concurrent or repeated confirmation
      const [batch] = await tx
        .select()
        .from(statementImportBatches)
        .where(
          and(
            eq(statementImportBatches.id, params.batchId),
            eq(statementImportBatches.householdId, params.householdId),
            eq(statementImportBatches.accountId, params.accountId),
          ),
        )
        .for("update");

      if (!batch) {
        throw new ImportBatchNotFoundError(
          `Import batch ${params.batchId} not found in household`,
        );
      }

      if (batch.status === "committed") {
        throw new ImportBatchAlreadyCommittedError(
          `Import batch ${params.batchId} has already been committed`,
        );
      }

      if (batch.status !== "preview") {
        throw new Error(`Import batch is in ${batch.status} status and cannot be committed`);
      }

      // 2. Fetch all rows for this batch
      const rows = await tx
        .select()
        .from(statementImportRows)
        .where(
          and(
            eq(statementImportRows.batchId, params.batchId),
            eq(statementImportRows.householdId, params.householdId),
          ),
        )
        .orderBy(asc(statementImportRows.rowIndex));

      const selectedSet = new Set(params.selectedRowIndices ?? []);
      const isSafeRow = (row: (typeof rows)[number]) =>
        isSafeToAutoCommitRow({
          valid:
            row.status !== "error" &&
            row.normalizedOccurredOn !== null &&
            row.normalizedAmountMinor !== null &&
            row.normalizedKind !== null &&
            row.normalizedCurrency !== null,
          status: row.status,
          ambiguityState: row.ambiguityState,
          errorCode: row.errorCode,
          normalizedOccurredOn: row.normalizedOccurredOn,
          normalizedAmountMinor: row.normalizedAmountMinor,
          normalizedCurrency: row.normalizedCurrency,
          normalizedKind: row.normalizedKind,
        });

      let importedCount = 0;
      let skippedCount = 0;
      const committedTransactionIds: string[] = [];
      const now = new Date();

      for (const row of rows) {
        const shouldCommit = params.safeOnly
          ? isSafeRow(row)
          : selectedSet.has(row.rowIndex);

        if (shouldCommit) {
          if (!params.safeOnly) {
            if (
              row.status === "error" ||
              !row.normalizedOccurredOn ||
              !row.normalizedAmountMinor ||
              !row.normalizedKind ||
              !row.normalizedCurrency
            ) {
              throw new Error(`Cannot commit invalid row ${row.rowIndex}`);
            }

            if (row.ambiguityState === "ambiguous") {
              throw new AmbiguousImportRowCommitError(
                `Cannot commit ambiguous import row ${row.rowIndex} without explicit resolution`,
              );
            }

            if (row.status === "duplicate") {
              throw new DuplicateImportRowError(
                `Cannot commit duplicate row ${row.rowIndex}`,
              );
            }
          }

          const newTxId = crypto.randomUUID();
          const amount = money(row.normalizedAmountMinor!, row.normalizedCurrency!);
          const domainTx =
            row.normalizedKind === "expense"
              ? createExpense({
                  id: toTransactionId(newTxId),
                  householdId: toHouseholdId(params.householdId),
                  accountId: toAccountId(params.accountId),
                  amount,
                  payee: row.normalizedPayee ?? row.normalizedDescription ?? "Imported expense",
                  paidByPersonId: toPersonId(params.personId),
                  occurredOn: row.normalizedOccurredOn!,
                  categoryId: null,
                  sourceNamespace: row.sourceNamespace,
                  sourceAccountId: row.sourceAccountId,
                  authoritativeId: row.authoritativeId,
                })
              : createIncome({
                  id: toTransactionId(newTxId),
                  householdId: toHouseholdId(params.householdId),
                  accountId: toAccountId(params.accountId),
                  amount,
                  source: row.normalizedSource ?? row.normalizedDescription ?? "Imported income",
                  receivedByPersonId: toPersonId(params.personId),
                  occurredOn: row.normalizedOccurredOn!,
                  categoryId: null,
                  sourceNamespace: row.sourceNamespace,
                  sourceAccountId: row.sourceAccountId,
                  authoritativeId: row.authoritativeId,
                });

          // Insert into transactions
          await tx.insert(transactions).values({
            id: domainTx.id,
            householdId: domainTx.householdId,
            kind: domainTx.kind,
            amountMinor: domainTx.amount.amountMinor,
            currency: domainTx.amount.currency,
            occurredOn: domainTx.occurredOn,
            accountId: domainTx.accountId,
            payee: domainTx.kind === "expense" ? domainTx.payee : null,
            paidByPersonId: domainTx.kind === "expense" ? domainTx.paidByPersonId : null,
            source: domainTx.kind === "income" ? domainTx.source : null,
            receivedByPersonId: domainTx.kind === "income" ? domainTx.receivedByPersonId : null,
            sourceNamespace: row.sourceNamespace,
            sourceAccountId: row.sourceAccountId ?? "",
            authoritativeId: row.authoritativeId ?? null,
            version: 1,
            createdAt: now,
            updatedAt: now,
          });

          // Insert audit entry with source = "import"
          const auditSnapshot = createTransactionAuditSnapshot(domainTx);
          await tx.insert(transactionAuditEntries).values({
            transactionId: domainTx.id,
            householdId: domainTx.householdId,
            revision: 1,
            operation: "create",
            source: "import",
            authUserId: params.authUserId,
            personId: params.personId,
            beforeState: null,
            afterState: auditSnapshot,
            recordedAt: now,
          });

          // Update import row
          await tx
            .update(statementImportRows)
            .set({
              status: "imported",
              committedTransactionId: domainTx.id,
              canonicalTransactionId: domainTx.id,
              updatedAt: now,
            })
            .where(eq(statementImportRows.id, row.id));

          committedTransactionIds.push(domainTx.id);
          importedCount++;
        } else {
          // Unselected row -> if duplicate, keep duplicate status and linkages; else skipped
          if (row.status === "duplicate") {
            await tx
              .update(statementImportRows)
              .set({
                status: "duplicate",
                updatedAt: now,
              })
              .where(eq(statementImportRows.id, row.id));
          } else {
            await tx
              .update(statementImportRows)
              .set({
                status: "skipped",
                updatedAt: now,
              })
              .where(eq(statementImportRows.id, row.id));
          }

          skippedCount++;
        }
      }

      // 3. Mark batch as committed
      await tx
        .update(statementImportBatches)
        .set({
          status: "committed",
          committedAt: now,
          importedRowCount: importedCount,
          skippedRowCount: skippedCount,
        })
        .where(eq(statementImportBatches.id, params.batchId));

      return {
        batchId: params.batchId,
        importedCount,
        skippedCount,
        committedTransactionIds,
      };
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
      pgError.code === "23505"
    ) {
      throw new DuplicateImportRowError(
        `Duplicate import rejected: one or more rows have already been imported for this account (${pgError.detail ?? ""})`,
      );
    }

    throw error;
  }
}
