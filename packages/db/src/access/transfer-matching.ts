import { and, desc, eq, isNull, or } from "drizzle-orm";

import {
  createTransactionAuditSnapshot,
  createTransfer,
  money,
  transactionId,
} from "@nodvis/finance-domain";
import type { Transaction } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { households } from "../schema/foundation";
import { liabilityRepayments } from "../schema/liabilities";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { statementImportRows } from "../schema/statement-imports";
import {
  transactionAuditEntries,
  transactions,
} from "../schema/transactions";
import { transferMatches } from "../schema/transfer-matches";
import {
  mapRowToTransaction,
  type TransactionAuditActor,
  TransactionAlreadyVoidedError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
} from "./transactions";

export class InvalidTransferMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransferMatchError";
  }
}

export type ExecuteTransferMatchParams = {
  householdId: string;
  outflowTransactionId: string;
  expectedOutflowVersion: number;
  inflowTransactionId: string;
  expectedInflowVersion: number;
  matchedIdentifier?: string | null | undefined;
  matchConfidence?: "automatic" | "manual" | undefined;
  notes?: string | null | undefined;
  audit?: TransactionAuditActor | undefined;
};

export type TransferMatchRecord = {
  id: string;
  householdId: string;
  transferTransactionId: string;
  matchedTransactionId: string;
  matchedIdentifier: string | null;
  matchConfidence: string;
  notes: string | null;
  matchedByAuthUserId: string | null;
  createdAt: Date;
};

export async function executeTransferMatch(
  params: ExecuteTransferMatchParams,
): Promise<{ transfer: Transaction; match: TransferMatchRecord }> {
  const db = getDb();
  const confidence = params.matchConfidence ?? "automatic";

  return await db.transaction(async (tx) => {
    await tx.select({ id: households.id }).from(households)
      .where(eq(households.id, params.householdId)).for("update");

    // 1. Fetch and validate outflow transaction (must be an active expense)
    const [outflowRow] = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, params.householdId),
          eq(transactions.id, params.outflowTransactionId),
        ),
      )
      .limit(1);

    if (!outflowRow) {
      throw new TransactionNotFoundError(
        `Outflow transaction ${params.outflowTransactionId} not found in household`,
      );
    }
    if (outflowRow.voidedAt !== null) {
      throw new TransactionAlreadyVoidedError(
        `Outflow transaction ${params.outflowTransactionId} is already voided`,
      );
    }
    if (outflowRow.version !== params.expectedOutflowVersion) {
      throw new TransactionVersionConflictError(
        `Outflow transaction was modified concurrently (expected version ${params.expectedOutflowVersion}, found ${outflowRow.version})`,
      );
    }
    if (outflowRow.kind !== "expense" || !outflowRow.accountId) {
      throw new InvalidTransferMatchError(
        `Outflow transaction ${params.outflowTransactionId} is not an expense`,
      );
    }

    // 2. Fetch and validate inflow transaction (must be an active income)
    const [inflowRow] = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, params.householdId),
          eq(transactions.id, params.inflowTransactionId),
        ),
      )
      .limit(1);

    if (!inflowRow) {
      throw new TransactionNotFoundError(
        `Inflow transaction ${params.inflowTransactionId} not found in household`,
      );
    }
    if (inflowRow.voidedAt !== null) {
      throw new TransactionAlreadyVoidedError(
        `Inflow transaction ${params.inflowTransactionId} is already voided`,
      );
    }
    if (inflowRow.version !== params.expectedInflowVersion) {
      throw new TransactionVersionConflictError(
        `Inflow transaction was modified concurrently (expected version ${params.expectedInflowVersion}, found ${inflowRow.version})`,
      );
    }
    if (inflowRow.kind !== "income" || !inflowRow.accountId) {
      throw new InvalidTransferMatchError(
        `Inflow transaction ${params.inflowTransactionId} is not an income`,
      );
    }

    const linkedRepayments = await tx.select({ id: liabilityRepayments.id })
      .from(liabilityRepayments)
      .where(and(
        eq(liabilityRepayments.householdId, params.householdId),
        isNull(liabilityRepayments.voidedAt),
        or(
          eq(liabilityRepayments.transactionId, params.outflowTransactionId),
          eq(liabilityRepayments.transactionId, params.inflowTransactionId),
        ),
      )).limit(1);
    const linkedBnpl = await tx.select({ id: bnplPurchases.id })
      .from(bnplPurchases)
      .where(and(
        eq(bnplPurchases.householdId, params.householdId),
        isNull(bnplPurchases.voidedAt),
        or(
          eq(bnplPurchases.transactionId, params.outflowTransactionId),
          eq(bnplPurchases.transactionId, params.inflowTransactionId),
        ),
      )).limit(1);
    if (linkedRepayments.length > 0 || linkedBnpl.length > 0) {
      throw new InvalidTransferMatchError(
        "Transactions linked to a liability repayment or BNPL purchase cannot be matched as transfers",
      );
    }

    if (confidence === "automatic" && !params.matchedIdentifier?.trim()) {
      throw new InvalidTransferMatchError(
        "Automatic transfer matches require a verified account identifier",
      );
    }

    // Ensure they belong to different accounts
    if (outflowRow.accountId === inflowRow.accountId) {
      throw new InvalidTransferMatchError(
        "Cannot match transfer between identical accounts",
      );
    }

    if (
      outflowRow.currency !== inflowRow.currency ||
      outflowRow.amountMinor !== inflowRow.amountMinor
    ) {
      throw new InvalidTransferMatchError(
        "Transfer matching requires equal currency and amount; cross-currency or unequal operations need review",
      );
    }

    const now = new Date();
    const existingOutflowTx = mapRowToTransaction(outflowRow);
    const existingInflowTx = mapRowToTransaction(inflowRow);

    // 3. Transform outflow into one logical transfer
    const updatedTransferTx = createTransfer({
      id: existingOutflowTx.id,
      householdId: existingOutflowTx.householdId,
      fromAccountId: outflowRow.accountId as any,
      toAccountId: inflowRow.accountId as any,
      amount: existingOutflowTx.amount,
      occurredOn: existingOutflowTx.occurredOn,
      version: outflowRow.version + 1,
      voidedAt: null,
      voidReason: null,
      sourceNamespace: outflowRow.sourceNamespace,
      sourceAccountId: outflowRow.sourceAccountId,
      authoritativeId: outflowRow.authoritativeId,
    });

    const [updatedTransferRow] = await tx
      .update(transactions)
      .set({
        kind: "transfer",
        fromAccountId: outflowRow.accountId,
        toAccountId: inflowRow.accountId,
        accountId: null,
        categoryId: null,
        payee: null,
        source: null,
        paidByPersonId: null,
        receivedByPersonId: null,
        version: outflowRow.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(transactions.householdId, params.householdId),
          eq(transactions.id, params.outflowTransactionId),
          eq(transactions.version, params.expectedOutflowVersion),
          isNull(transactions.voidedAt),
        ),
      )
      .returning();

    if (!updatedTransferRow) {
      throw new TransactionVersionConflictError(
        "Outflow transaction was modified concurrently during transfer match",
      );
    }

    // Append audit for outflow conversion
    const beforeOutflowSnapshot = createTransactionAuditSnapshot(existingOutflowTx);
    const afterTransferSnapshot = createTransactionAuditSnapshot(updatedTransferTx);

    await tx.insert(transactionAuditEntries).values({
      transactionId: updatedTransferRow.id,
      householdId: updatedTransferRow.householdId,
      revision: updatedTransferRow.version,
      operation: "correction",
      source: params.audit?.source ?? (confidence === "automatic" ? "system" : "manual"),
      authUserId: params.audit?.authUserId ?? null,
      personId: params.audit?.personId ?? null,
      beforeState: beforeOutflowSnapshot,
      afterState: afterTransferSnapshot,
      voidReason: null,
      recordedAt: now,
    });

    // 4. Void the counterpart inflow transaction
    const voidReason = `Matched into transfer with transaction ${params.outflowTransactionId}`;
    const [voidedInflowRow] = await tx
      .update(transactions)
      .set({
        voidedAt: now,
        voidReason,
        version: inflowRow.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(transactions.householdId, params.householdId),
          eq(transactions.id, params.inflowTransactionId),
          eq(transactions.version, params.expectedInflowVersion),
          isNull(transactions.voidedAt),
        ),
      )
      .returning();

    if (!voidedInflowRow) {
      throw new TransactionVersionConflictError(
        "Inflow transaction was modified concurrently during transfer match",
      );
    }

    // Append audit for inflow void
    const beforeInflowSnapshot = createTransactionAuditSnapshot(existingInflowTx);
    const voidedInflowTx = mapRowToTransaction(voidedInflowRow);
    const afterInflowSnapshot = createTransactionAuditSnapshot(voidedInflowTx);

    await tx.insert(transactionAuditEntries).values({
      transactionId: voidedInflowRow.id,
      householdId: voidedInflowRow.householdId,
      revision: voidedInflowRow.version,
      operation: "void",
      source: params.audit?.source ?? (confidence === "automatic" ? "system" : "manual"),
      authUserId: params.audit?.authUserId ?? null,
      personId: params.audit?.personId ?? null,
      beforeState: beforeInflowSnapshot,
      afterState: afterInflowSnapshot,
      voidReason,
      recordedAt: now,
    });

    // 5. Update import rows provenance to link canonical transaction to transfer
    await tx
      .update(statementImportRows)
      .set({
        canonicalTransactionId: updatedTransferRow.id,
        updatedAt: now,
      })
      .where(
        and(
          eq(statementImportRows.householdId, params.householdId),
          eq(statementImportRows.committedTransactionId, inflowRow.id),
        ),
      );

    // 6. Record transfer reconciliation entry in transfer_matches
    const [matchRecord] = await tx
      .insert(transferMatches)
      .values({
        householdId: params.householdId,
        transferTransactionId: updatedTransferRow.id,
        matchedTransactionId: inflowRow.id,
        matchedIdentifier: params.matchedIdentifier?.trim() || null,
        matchConfidence: confidence,
        notes: params.notes?.trim() || null,
        matchedByAuthUserId: params.audit?.authUserId ?? null,
        createdAt: now,
      })
      .returning();

    if (!matchRecord) {
      throw new Error("Failed to insert transfer match record");
    }

    return {
      transfer: mapRowToTransaction(updatedTransferRow),
      match: matchRecord,
    };
  });
}

export async function listTransferMatchesByHousehold(
  householdId: string,
  options?: { limit?: number | undefined },
): Promise<TransferMatchRecord[]> {
  const db = getDb();
  let query = db
    .select()
    .from(transferMatches)
    .where(eq(transferMatches.householdId, householdId))
    .orderBy(desc(transferMatches.createdAt));

  if (options?.limit && options.limit > 0) {
    query = query.limit(options.limit) as typeof query;
  }

  return await query;
}
