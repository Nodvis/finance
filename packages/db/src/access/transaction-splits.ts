import { and, eq, inArray, sql } from "drizzle-orm";
import { createSplitAllocations, money } from "@nodvis/finance-domain";
import { getDb } from "../client";
import { categories } from "../schema/categories";
import { transactionSplitAllocations } from "../schema/transaction-splits";
import { obligations } from "../schema/obligations";
import { liabilityRepayments } from "../schema/liabilities";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { transactionAuditEntries, transactions } from "../schema/transactions";

export type SplitAllocationInput = { categoryId: string; amountMinor: bigint; currency: string };
export class SplitTransactionNotFoundError extends Error {}
export class SplitValidationError extends Error {}
export class SplitVersionConflictError extends Error {}

export async function replaceTransactionSplit(params: { householdId: string; transactionId: string; expectedVersion: number; authUserId: string; personId: string; allocations: SplitAllocationInput[] }) {
  return getDb().transaction(async (tx) => {
    const [parent] = await tx.select().from(transactions).where(and(eq(transactions.householdId, params.householdId), eq(transactions.id, params.transactionId))).for("update");
    if (!parent) throw new SplitTransactionNotFoundError("Transaction not found in household");
    if (parent.version !== params.expectedVersion) throw new SplitVersionConflictError("Transaction was modified concurrently");
    if (parent.kind !== "expense") throw new SplitValidationError("Only expense transactions can be split");
    if (parent.voidedAt) throw new SplitValidationError("Voided transactions cannot be split");
    const [linked] = await tx.select({ id: transactions.id }).from(transactions).where(and(
      eq(transactions.id, parent.id),
      sql`(
        exists (select 1 from ${liabilityRepayments} lr where lr.household_id = ${parent.householdId} and lr.transaction_id = ${parent.id} and lr.voided_at is null)
        or exists (select 1 from ${obligations} o where o.household_id = ${parent.householdId} and o.transaction_id = ${parent.id} and o.cancelled_at is null)
        or exists (select 1 from ${bnplPurchases} bp where bp.household_id = ${parent.householdId} and bp.transaction_id = ${parent.id} and bp.voided_at is null)
      `),
    );
    if (linked) throw new SplitValidationError("Linked repayment, obligation, or BNPL transactions cannot be split");
    const before = await tx.select().from(transactionSplitAllocations).where(and(eq(transactionSplitAllocations.householdId, params.householdId), eq(transactionSplitAllocations.transactionId, params.transactionId)));
    const categoryIds = params.allocations.map((a) => a.categoryId);
    const found = await tx.select({ id: categories.id, archivedAt: categories.archivedAt, applicability: categories.applicability }).from(categories).where(and(eq(categories.householdId, params.householdId), inArray(categories.id, categoryIds)));
    if (found.length !== categoryIds.length || found.some((c) => c.archivedAt || (c.applicability !== "expense" && c.applicability !== "both"))) throw new SplitValidationError("Every split category must be an active expense category in the household");
    try { createSplitAllocations({ kind: "expense", amount: money(parent.amountMinor, parent.currency) } as never, params.allocations.map((a) => ({ categoryId: a.categoryId as never, amount: money(a.amountMinor, a.currency) }))); } catch (error) { throw new SplitValidationError((error as Error).message); }
    await tx.delete(transactionSplitAllocations).where(and(eq(transactionSplitAllocations.householdId, params.householdId), eq(transactionSplitAllocations.transactionId, params.transactionId)));
    const rows = await tx.insert(transactionSplitAllocations).values(params.allocations.map((a) => ({ householdId: params.householdId, transactionId: params.transactionId, categoryId: a.categoryId, amountMinor: a.amountMinor, currency: a.currency }))).returning();
    const [updated] = await tx.update(transactions).set({ version: sql`${transactions.version} + 1`, updatedAt: new Date() }).where(and(eq(transactions.householdId, params.householdId), eq(transactions.id, params.transactionId), eq(transactions.version, params.expectedVersion))).returning();
    if (!updated) throw new SplitVersionConflictError("Transaction was modified concurrently");
    const state = (allocations: SplitAllocationInput[]) => allocations.map((a) => ({ categoryId: a.categoryId, amountMinor: a.amountMinor.toString(), currency: a.currency }));
    await tx.insert(transactionAuditEntries).values({ transactionId: updated.id, householdId: updated.householdId, revision: updated.version, operation: "correction", source: "manual", authUserId: params.authUserId, personId: params.personId, beforeState: { kind: parent.kind, amountMinor: parent.amountMinor.toString(), currency: parent.currency, occurredOn: parent.occurredOn.toISOString(), accountId: parent.accountId, categoryId: parent.categoryId, payee: parent.payee, paidByPersonId: parent.paidByPersonId, source: null, receivedByPersonId: null, fromAccountId: null, toAccountId: null, version: parent.version, voidedAt: parent.voidedAt ? new Date(parent.voidedAt as Date).toISOString() : null, voidReason: parent.voidReason, splitAllocations: state(before) }, afterState: { kind: updated.kind, amountMinor: updated.amountMinor.toString(), currency: updated.currency, occurredOn: updated.occurredOn.toISOString(), accountId: updated.accountId, categoryId: updated.categoryId, payee: updated.payee, paidByPersonId: updated.paidByPersonId, source: null, receivedByPersonId: null, fromAccountId: null, toAccountId: null, version: updated.version, voidedAt: updated.voidedAt ? new Date(updated.voidedAt as Date).toISOString() : null, voidReason: updated.voidReason, splitAllocations: state(params.allocations) } });
    return rows.map((r) => ({ id: r.id, householdId: r.householdId, transactionId: r.transactionId, categoryId: r.categoryId, amountMinor: r.amountMinor.toString(), currency: r.currency }));
  });
}

export async function listTransactionSplits(householdId: string, transactionId: string) {
  const [parent] = await getDb().select({ version: transactions.version }).from(transactions).where(and(eq(transactions.householdId, householdId), eq(transactions.id, transactionId)));
  if (!parent) throw new SplitTransactionNotFoundError("Transaction not found in household");
  const rows = await getDb().select().from(transactionSplitAllocations).where(and(eq(transactionSplitAllocations.householdId, householdId), eq(transactionSplitAllocations.transactionId, transactionId)));
  return { version: parent.version, allocations: rows.map((r) => ({ id: r.id, householdId: r.householdId, transactionId: r.transactionId, categoryId: r.categoryId, amountMinor: r.amountMinor.toString(), currency: r.currency })) };
}
