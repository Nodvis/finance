import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";

import {
  bnplPurchaseId,
  createBnplPurchase,
  creditFacilityId,
  currencyCode,
  householdId,
  money,
  transactionId,
  updateBnplPurchase,
  voidBnplPurchase,
} from "@nodvis/finance-domain";
import type {
  BnplPaymentModel,
  BnplPurchaseStatus,
  CreateBnplPurchaseInput,
  UpdateBnplPurchaseInput,
} from "@nodvis/finance-domain";
import type { Money } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { creditFacilities } from "../schema/credit-facilities";
import { households } from "../schema/foundation";
import { liabilityRepayments } from "../schema/liabilities";
import { obligations } from "../schema/obligations";
import { transactions } from "../schema/transactions";

type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// The link identifies an economic purchase, never income or a repayment.
async function validatePurchaseTransaction(
  db: DbTransaction,
  household: string,
  id: string | null,
  currency: string,
  amount: bigint,
  excludePurchaseId?: string,
) {
  if (id === null) return;
  const [row] = await db.select().from(transactions).where(and(
    eq(transactions.id, id), eq(transactions.householdId, household),
  )).for("share");
  if (!row || row.voidedAt !== null || row.kind !== "expense" || row.currency !== currency || row.amountMinor !== amount) {
    throw new BnplPurchaseFacilityError("BNPL purchase transaction is invalid");
  }

  // Enforce BNPL duplicate active transaction link
  const [existingBnpl] = await db.select().from(bnplPurchases).where(and(
    eq(bnplPurchases.householdId, household),
    eq(bnplPurchases.transactionId, id),
    isNull(bnplPurchases.voidedAt),
    excludePurchaseId ? ne(bnplPurchases.id, excludePurchaseId) : undefined,
  )).limit(1);
  if (existingBnpl) {
    throw new BnplPurchaseFacilityError("BNPL purchase transaction is already linked to another active BNPL purchase");
  }

  // Enforce conflict against active repayment links
  const [existingRepayment] = await db.select().from(liabilityRepayments).where(and(
    eq(liabilityRepayments.householdId, household),
    eq(liabilityRepayments.transactionId, id),
    isNull(liabilityRepayments.voidedAt),
  )).limit(1);
  if (existingRepayment) {
    throw new BnplPurchaseFacilityError("BNPL purchase transaction conflicts with an active liability repayment");
  }

  // Enforce conflict against active obligation links
  const [existingObligation] = await db.select().from(obligations).where(and(
    eq(obligations.householdId, household),
    eq(obligations.transactionId, id),
    isNull(obligations.cancelledAt),
  )).limit(1);
  if (existingObligation) {
    throw new BnplPurchaseFacilityError("BNPL purchase transaction conflicts with an active obligation");
  }
}

export class BnplPurchaseNotFoundError extends Error {
  constructor() {
    super("BNPL purchase not found in household");
    this.name = "BnplPurchaseNotFoundError";
  }
}

export class BnplPurchaseFacilityError extends Error {
  constructor(message = "BNPL purchase facility is invalid") {
    super(message);
    this.name = "BnplPurchaseFacilityError";
  }
}

export class BnplPurchaseVersionConflictError extends Error {
  constructor() {
    super("BNPL purchase was modified concurrently");
    this.name = "BnplPurchaseVersionConflictError";
  }
}

type Row = typeof bnplPurchases.$inferSelect;

export type BnplPurchaseSummary = Row;

export function serializeBnplPurchase(row: Row) {
  return {
    ...row,
    originalAmountMinor: row.originalAmountMinor.toString(),
    financedAmountMinor: row.financedAmountMinor.toString(),
    observedOutstandingMinor: row.observedOutstandingMinor?.toString() ?? null,
    principalMinor: row.principalMinor?.toString() ?? null,
    interestMinor: row.interestMinor?.toString() ?? null,
    feeMinor: row.feeMinor?.toString() ?? null,
    purchaseDate: row.purchaseDate.toISOString(),
    financingDate: row.financingDate.toISOString(),
    observedOutstandingAt: row.observedOutstandingAt?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getFacility(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], householdIdValue: string, facilityIdValue: string) {
  const [facility] = await tx
    .select({ id: creditFacilities.id, kind: creditFacilities.kind, currency: creditFacilities.currency })
    .from(creditFacilities)
    .where(and(eq(creditFacilities.id, facilityIdValue), eq(creditFacilities.householdId, householdIdValue), isNull(creditFacilities.archivedAt)))
    .limit(1);
  if (!facility || facility.kind !== "bnpl") throw new BnplPurchaseFacilityError();
  return facility;
}

export async function listBnplPurchasesByHousehold(householdIdValue: string, options: { facilityId?: string; includeVoided?: boolean } = {}) {
  const db = getDb();
  const conditions = [eq(bnplPurchases.householdId, householdIdValue)];
  if (options.facilityId) conditions.push(eq(bnplPurchases.creditFacilityId, options.facilityId));
  if (!options.includeVoided) conditions.push(isNull(bnplPurchases.voidedAt));
  return db.select().from(bnplPurchases).where(and(...conditions)).orderBy(desc(bnplPurchases.purchaseDate), asc(bnplPurchases.id));
}

export async function getBnplPurchase(householdIdValue: string, purchaseIdValue: string) {
  const db = getDb();
  const [row] = await db.select().from(bnplPurchases).where(and(eq(bnplPurchases.householdId, householdIdValue), eq(bnplPurchases.id, purchaseIdValue))).limit(1);
  if (!row) throw new BnplPurchaseNotFoundError();
  return row;
}

export type CreateBnplPurchaseRecordInput = Omit<CreateBnplPurchaseInput, "id" | "householdId" | "creditFacilityId" | "originalAmount" | "financedAmount" | "currency"> & {
  householdId: string;
  creditFacilityId: string;
  originalAmountMinor: bigint;
  financedAmountMinor: bigint;
  currency: string;
};

function toDomainInput(input: CreateBnplPurchaseRecordInput, facilityCurrency: string) {
  return createBnplPurchase({
    ...input,
    id: bnplPurchaseId(crypto.randomUUID()),
    householdId: householdId(input.householdId),
    creditFacilityId: creditFacilityId(input.creditFacilityId),
    currency: facilityCurrency,
    originalAmount: money(input.originalAmountMinor, facilityCurrency),
    financedAmount: money(input.financedAmountMinor, facilityCurrency),
  });
}

export async function createBnplPurchaseRecord(input: CreateBnplPurchaseRecordInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.select({ id: households.id }).from(households)
      .where(eq(households.id, input.householdId)).for("update");
    const facility = await getFacility(tx, input.householdId, input.creditFacilityId);
    if (facility.currency !== input.currency) throw new BnplPurchaseFacilityError("BNPL purchase currency must match facility currency");
    const domain = toDomainInput(input, facility.currency);
    await validatePurchaseTransaction(tx, input.householdId, domain.transactionId, domain.currency, domain.originalAmount.amountMinor);
    const [row] = await tx.insert(bnplPurchases).values({
      id: domain.id,
      householdId: input.householdId,
      creditFacilityId: input.creditFacilityId,
      provider: domain.provider,
      product: domain.product,
      merchant: domain.merchant,
      description: domain.description,
      purchaseDate: domain.purchaseDate,
      financingDate: domain.financingDate,
      originalAmountMinor: domain.originalAmount.amountMinor,
      financedAmountMinor: domain.financedAmount.amountMinor,
      currency: domain.currency,
      observedOutstandingMinor: domain.observedOutstanding?.amountMinor ?? null,
      observedOutstandingAt: domain.observedOutstandingAt,
      paymentModel: domain.paymentModel,
      status: domain.status,
      dueDate: domain.dueDate,
      principalMinor: domain.principalAmount?.amountMinor ?? null,
      interestMinor: domain.interestAmount?.amountMinor ?? null,
      feeMinor: domain.feeAmount?.amountMinor ?? null,
      transactionId: domain.transactionId,
      version: 1,
      voidedAt: null,
      voidReason: null,
    }).returning();
    if (!row) throw new Error("BNPL purchase was not created");
    return row;
  });
}

export async function updateBnplPurchaseRecord(householdIdValue: string, purchaseIdValue: string, version: number, input: Omit<UpdateBnplPurchaseInput, "originalAmount" | "financedAmount" | "observedOutstanding"> & { originalAmountMinor?: bigint; financedAmountMinor?: bigint; observedOutstanding?: bigint | null }) {
  return getDb().transaction(async (db) => {
    await db.select({ id: households.id }).from(households)
      .where(eq(households.id, householdIdValue)).for("update");
    const [existing] = await db.select().from(bnplPurchases).where(and(
      eq(bnplPurchases.householdId, householdIdValue), eq(bnplPurchases.id, purchaseIdValue),
    )).for("update");
    if (!existing) throw new BnplPurchaseNotFoundError();
    if (existing.version !== version) throw new BnplPurchaseVersionConflictError();
    if (existing.voidedAt) throw new BnplPurchaseFacilityError("Voided BNPL purchase cannot be updated");
    const domainUpdate = { ...input } as unknown as {
      provider?: string;
      product?: string;
      merchant?: string;
      description?: string | null;
      purchaseDate?: Date;
      financingDate?: Date;
      originalAmount?: Money;
      financedAmount?: Money;
      observedOutstanding?: Money | null;
      observedOutstandingAt?: Date | null;
      paymentModel?: BnplPaymentModel;
      status?: BnplPurchaseStatus;
      dueDate?: Date | null;
      principalAmount?: Money | null;
      interestAmount?: Money | null;
      feeAmount?: Money | null;
      transactionId?: ReturnType<typeof transactionId> | null;
    };
    if (input.originalAmountMinor !== undefined) domainUpdate.originalAmount = money(input.originalAmountMinor, existing.currency);
    if (input.financedAmountMinor !== undefined) domainUpdate.financedAmount = money(input.financedAmountMinor, existing.currency);
    if (input.observedOutstanding !== undefined) domainUpdate.observedOutstanding = input.observedOutstanding === null ? null : money(input.observedOutstanding, existing.currency);
    const domain = updateBnplPurchase({
      ...existing,
      id: bnplPurchaseId(existing.id),
      householdId: householdId(existing.householdId),
      creditFacilityId: creditFacilityId(existing.creditFacilityId),
      originalAmount: money(input.originalAmountMinor ?? existing.originalAmountMinor, existing.currency),
      financedAmount: money(input.financedAmountMinor ?? existing.financedAmountMinor, existing.currency),
      currency: currencyCode(existing.currency),
      observedOutstanding: existing.observedOutstandingMinor === null ? null : money(existing.observedOutstandingMinor, existing.currency),
      principalAmount: existing.principalMinor === null ? null : money(existing.principalMinor, existing.currency),
      interestAmount: existing.interestMinor === null ? null : money(existing.interestMinor, existing.currency),
      feeAmount: existing.feeMinor === null ? null : money(existing.feeMinor, existing.currency),
      transactionId: existing.transactionId === null ? null : transactionId(existing.transactionId),
    }, domainUpdate);
    await validatePurchaseTransaction(db, householdIdValue, domain.transactionId, domain.currency, domain.originalAmount.amountMinor, purchaseIdValue);
    const [row] = await db.update(bnplPurchases).set({
      provider: domain.provider, product: domain.product, merchant: domain.merchant, description: domain.description,
      purchaseDate: domain.purchaseDate, financingDate: domain.financingDate,
      originalAmountMinor: domain.originalAmount.amountMinor, financedAmountMinor: domain.financedAmount.amountMinor,
      observedOutstandingMinor: domain.observedOutstanding?.amountMinor ?? null, observedOutstandingAt: domain.observedOutstandingAt,
      paymentModel: domain.paymentModel, status: domain.status, dueDate: domain.dueDate,
      principalMinor: domain.principalAmount?.amountMinor ?? null, interestMinor: domain.interestAmount?.amountMinor ?? null,
      feeMinor: domain.feeAmount?.amountMinor ?? null, transactionId: domain.transactionId,
      version: version + 1, updatedAt: new Date(),
    }).where(and(eq(bnplPurchases.id, purchaseIdValue), eq(bnplPurchases.householdId, householdIdValue), eq(bnplPurchases.version, version), isNull(bnplPurchases.voidedAt))).returning();
    if (!row) throw new BnplPurchaseVersionConflictError();
    return row;
  });
}

export async function voidBnplPurchaseRecord(householdIdValue: string, purchaseIdValue: string, version: number, reason: string | null) {
  const existing = await getBnplPurchase(householdIdValue, purchaseIdValue);
  if (existing.version !== version) throw new BnplPurchaseVersionConflictError();
  const domain = voidBnplPurchase({ ...existing, id: bnplPurchaseId(existing.id), householdId: householdId(existing.householdId), creditFacilityId: creditFacilityId(existing.creditFacilityId), originalAmount: money(existing.originalAmountMinor, existing.currency), financedAmount: money(existing.financedAmountMinor, existing.currency), currency: currencyCode(existing.currency), observedOutstanding: existing.observedOutstandingMinor === null ? null : money(existing.observedOutstandingMinor, existing.currency), principalAmount: existing.principalMinor === null ? null : money(existing.principalMinor, existing.currency), interestAmount: existing.interestMinor === null ? null : money(existing.interestMinor, existing.currency), feeAmount: existing.feeMinor === null ? null : money(existing.feeMinor, existing.currency), transactionId: existing.transactionId === null ? null : transactionId(existing.transactionId) }, reason);
  const db = getDb();
  const [row] = await db.update(bnplPurchases).set({ voidedAt: domain.voidedAt, voidReason: domain.voidReason, version: version + 1, updatedAt: new Date() }).where(and(eq(bnplPurchases.id, purchaseIdValue), eq(bnplPurchases.householdId, householdIdValue), eq(bnplPurchases.version, version), isNull(bnplPurchases.voidedAt))).returning();
  if (!row) throw new BnplPurchaseVersionConflictError();
  return row;
}
