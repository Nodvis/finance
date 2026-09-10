import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import type {
  Liability,
  LiabilityKind,
  LiabilityRepayment,
  RepaymentAllocationState,
  Transaction,
} from "@nodvis/finance-domain";
import {
  accountId as toAccountId,
  createLiability,
  createLiabilityRepayment,
  createTransactionAuditSnapshot,
  currencyCode,
  householdId as toHouseholdId,
  liabilityId as toLiabilityId,
  liabilityRepaymentId as toLiabilityRepaymentId,
  money,
  personId as toPersonId,
  transactionId as toTransactionId,
  voidLiabilityRepayment,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import {
  accounts,
  householdMemberships,
  households,
  persons,
} from "../schema/foundation";
import {
  liabilities,
  liabilityRepayments,
} from "../schema/liabilities";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { obligations } from "../schema/obligations";
import {
  transactionAuditEntries,
  transactions,
} from "../schema/transactions";
import type {
  NewTransactionAuditRow,
  NewTransactionRow,
  TransactionAuditActor,
} from "./transactions";
import { mapRowToTransaction } from "./transactions";

export class LiabilityNotFoundError extends Error {
  constructor(message: string = "Liability not found in household") {
    super(message);
    this.name = "LiabilityNotFoundError";
  }
}

export class LiabilityVersionConflictError extends Error {
  constructor(message: string = "Liability was modified concurrently") {
    super(message);
    this.name = "LiabilityVersionConflictError";
  }
}

export class LiabilityDestinationAccountNotFoundError extends Error {
  constructor(message: string = "Repayment destination account not found") {
    super(message);
    this.name = "LiabilityDestinationAccountNotFoundError";
  }
}

export class LiabilityDestinationAccountInvalidHouseholdError extends Error {
  constructor(
    message: string = "Repayment destination account must belong to the same household",
  ) {
    super(message);
    this.name = "LiabilityDestinationAccountInvalidHouseholdError";
  }
}

export class LiabilityDestinationAccountCurrencyMismatchError extends Error {
  constructor(message: string = "Destination account currency must match liability currency") {
    super(message);
    this.name = "LiabilityDestinationAccountCurrencyMismatchError";
  }
}

export class LiabilityRepaymentNotFoundError extends Error {
  constructor(message: string = "Liability repayment not found in household") {
    super(message);
    this.name = "LiabilityRepaymentNotFoundError";
  }
}

export class LiabilityRepaymentAlreadyVoidedError extends Error {
  constructor(message: string = "Liability repayment is already voided") {
    super(message);
    this.name = "LiabilityRepaymentAlreadyVoidedError";
  }
}

export class LiabilityRepaymentVersionConflictError extends Error {
  constructor(message: string = "Liability repayment was modified concurrently") {
    super(message);
    this.name = "LiabilityRepaymentVersionConflictError";
  }
}

export type HouseholdLiabilitySummary = Readonly<{
  id: string;
  householdId: string;
  name: string;
  kind: LiabilityKind;
  currency: string;
  observedOutstandingMinor: bigint | null;
  observedOutstandingAt: Date | null;
  responsiblePersonId: string | null;
  responsiblePersonName: string | null;
  lender: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  notes: string | null;
  version: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type LiabilityRow = typeof liabilities.$inferSelect;
export type LiabilityRepaymentRow = typeof liabilityRepayments.$inferSelect;

export function mapRowToLiability(row: LiabilityRow): Liability {
  return createLiability({
    id: toLiabilityId(row.id),
    householdId: toHouseholdId(row.householdId),
    name: row.name,
    kind: row.kind as LiabilityKind,
    currency: row.currency,
    observedOutstanding:
      row.observedOutstandingMinor !== null
        ? money(row.observedOutstandingMinor, row.currency)
        : null,
    observedOutstandingAt: row.observedOutstandingAt,
    responsiblePersonId: row.responsiblePersonId ? toPersonId(row.responsiblePersonId) : null,
    lender: row.lender,
    destinationAccountId: row.destinationAccountId ? toAccountId(row.destinationAccountId) : null,
    notes: row.notes,
    version: row.version,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapRowToLiabilityRepayment(row: LiabilityRepaymentRow): LiabilityRepayment {
  return createLiabilityRepayment({
    id: toLiabilityRepaymentId(row.id),
    householdId: toHouseholdId(row.householdId),
    liabilityId: toLiabilityId(row.liabilityId),
    transactionId: row.transactionId ? toTransactionId(row.transactionId) : null,
    paidAt: row.paidAt,
    amount: money(row.amountMinor, row.currency),
    principalAmount:
      row.principalMinor !== null ? money(row.principalMinor, row.currency) : null,
    interestAmount:
      row.interestMinor !== null ? money(row.interestMinor, row.currency) : null,
    feeAmount:
      row.feeMinor !== null ? money(row.feeMinor, row.currency) : null,
    notes: row.notes,
    version: row.version,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function findLiabilityById(
  householdId: string,
  liabilityId: string,
): Promise<HouseholdLiabilitySummary | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: liabilities.id,
      householdId: liabilities.householdId,
      name: liabilities.name,
      kind: liabilities.kind,
      currency: liabilities.currency,
      observedOutstandingMinor: liabilities.observedOutstandingMinor,
      observedOutstandingAt: liabilities.observedOutstandingAt,
      responsiblePersonId: liabilities.responsiblePersonId,
      responsiblePersonName: persons.displayName,
      lender: liabilities.lender,
      destinationAccountId: liabilities.destinationAccountId,
      destinationAccountName: accounts.name,
      notes: liabilities.notes,
      version: liabilities.version,
      archivedAt: liabilities.archivedAt,
      createdAt: liabilities.createdAt,
      updatedAt: liabilities.updatedAt,
    })
    .from(liabilities)
    .leftJoin(persons, eq(liabilities.responsiblePersonId, persons.id))
    .leftJoin(accounts, eq(liabilities.destinationAccountId, accounts.id))
    .where(
      and(
        eq(liabilities.householdId, householdId),
        eq(liabilities.id, liabilityId),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    kind: row.kind as LiabilityKind,
    responsiblePersonName: row.responsiblePersonName ?? null,
    destinationAccountName: row.destinationAccountName ?? null,
  };
}

export async function listLiabilitiesByHousehold(
  householdId: string,
  options: { includeArchived?: boolean } = { includeArchived: true },
): Promise<HouseholdLiabilitySummary[]> {
  const db = getDb();
  const conditions = [eq(liabilities.householdId, householdId)];
  if (!options.includeArchived) {
    conditions.push(isNull(liabilities.archivedAt));
  }

  const rows = await db
    .select({
      id: liabilities.id,
      householdId: liabilities.householdId,
      name: liabilities.name,
      kind: liabilities.kind,
      currency: liabilities.currency,
      observedOutstandingMinor: liabilities.observedOutstandingMinor,
      observedOutstandingAt: liabilities.observedOutstandingAt,
      responsiblePersonId: liabilities.responsiblePersonId,
      responsiblePersonName: persons.displayName,
      lender: liabilities.lender,
      destinationAccountId: liabilities.destinationAccountId,
      destinationAccountName: accounts.name,
      notes: liabilities.notes,
      version: liabilities.version,
      archivedAt: liabilities.archivedAt,
      createdAt: liabilities.createdAt,
      updatedAt: liabilities.updatedAt,
    })
    .from(liabilities)
    .leftJoin(persons, eq(liabilities.responsiblePersonId, persons.id))
    .leftJoin(accounts, eq(liabilities.destinationAccountId, accounts.id))
    .where(and(...conditions))
    .orderBy(asc(liabilities.name));

  return rows.map((r) => ({
    ...r,
    kind: r.kind as LiabilityKind,
    responsiblePersonName: r.responsiblePersonName ?? null,
    destinationAccountName: r.destinationAccountName ?? null,
  }));
}

export async function insertLiabilityInDb(
  householdId: string,
  liability: Liability,
): Promise<Liability> {
  const db = getDb();

  // Validate destination account if supplied
  if (liability.destinationAccountId) {
    const [dest] = await db
      .select({ id: accounts.id, householdId: accounts.householdId, currency: accounts.currency })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          eq(accounts.id, liability.destinationAccountId),
        ),
      )
      .limit(1);

    if (!dest) {
      throw new LiabilityDestinationAccountNotFoundError(
        `Repayment destination account ${liability.destinationAccountId} not found in household`,
      );
    }
    if (dest.currency !== liability.currency) {
      throw new LiabilityDestinationAccountCurrencyMismatchError(
        `Destination account currency (${dest.currency}) does not match liability currency (${liability.currency})`,
      );
    }
  }

  const [inserted] = await db
    .insert(liabilities)
    .values({
      id: liability.id,
      householdId,
      name: liability.name,
      kind: liability.kind,
      currency: liability.currency,
      observedOutstandingMinor: liability.observedOutstanding?.amountMinor ?? null,
      observedOutstandingAt: liability.observedOutstandingAt,
      responsiblePersonId: liability.responsiblePersonId,
      lender: liability.lender,
      destinationAccountId: liability.destinationAccountId,
      notes: liability.notes,
      version: liability.version,
      archivedAt: liability.archivedAt,
      createdAt: liability.createdAt,
      updatedAt: liability.updatedAt,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to insert liability");
  }

  return mapRowToLiability(inserted);
}

export async function updateLiabilityInDb(params: {
  householdId: string;
  id: string;
  expectedVersion: number;
  liability: Liability;
}): Promise<Liability> {
  const db = getDb();
  const next = params.liability;

  if (next.destinationAccountId) {
    const [dest] = await db
      .select({ id: accounts.id, householdId: accounts.householdId, currency: accounts.currency })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, params.householdId),
          eq(accounts.id, next.destinationAccountId),
        ),
      )
      .limit(1);

    if (!dest) {
      throw new LiabilityDestinationAccountNotFoundError(
        `Repayment destination account ${next.destinationAccountId} not found in household`,
      );
    }
    if (dest.currency !== next.currency) {
      throw new LiabilityDestinationAccountCurrencyMismatchError(
        `Destination account currency (${dest.currency}) does not match liability currency (${next.currency})`,
      );
    }
  }

  const [updated] = await db
    .update(liabilities)
    .set({
      name: next.name,
      kind: next.kind,
      observedOutstandingMinor: next.observedOutstanding?.amountMinor ?? null,
      observedOutstandingAt: next.observedOutstandingAt,
      responsiblePersonId: next.responsiblePersonId,
      lender: next.lender,
      destinationAccountId: next.destinationAccountId,
      notes: next.notes,
      version: params.expectedVersion + 1,
      archivedAt: next.archivedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(liabilities.householdId, params.householdId),
        eq(liabilities.id, params.id),
        eq(liabilities.version, params.expectedVersion),
      ),
    )
    .returning();

  if (!updated) {
    const [existing] = await db
      .select({ id: liabilities.id, version: liabilities.version })
      .from(liabilities)
      .where(
        and(
          eq(liabilities.householdId, params.householdId),
          eq(liabilities.id, params.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new LiabilityNotFoundError();
    }
    throw new LiabilityVersionConflictError(
      `Liability was modified concurrently (expected version ${params.expectedVersion}, found ${existing.version})`,
    );
  }

  return mapRowToLiability(updated);
}

export async function archiveLiabilityInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
): Promise<Liability> {
  const db = getDb();
  const [updated] = await db
    .update(liabilities)
    .set({
      archivedAt: new Date(),
      version: expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(liabilities.householdId, householdId),
        eq(liabilities.id, id),
        eq(liabilities.version, expectedVersion),
      ),
    )
    .returning();

  if (!updated) {
    const [existing] = await db
      .select({ id: liabilities.id, version: liabilities.version })
      .from(liabilities)
      .where(
        and(
          eq(liabilities.householdId, householdId),
          eq(liabilities.id, id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new LiabilityNotFoundError();
    }
    throw new LiabilityVersionConflictError();
  }

  return mapRowToLiability(updated);
}

export async function unarchiveLiabilityInDb(
  householdId: string,
  id: string,
  expectedVersion: number,
): Promise<Liability> {
  const db = getDb();
  const [updated] = await db
    .update(liabilities)
    .set({
      archivedAt: null,
      version: expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(liabilities.householdId, householdId),
        eq(liabilities.id, id),
        eq(liabilities.version, expectedVersion),
      ),
    )
    .returning();

  if (!updated) {
    const [existing] = await db
      .select({ id: liabilities.id, version: liabilities.version })
      .from(liabilities)
      .where(
        and(
          eq(liabilities.householdId, householdId),
          eq(liabilities.id, id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new LiabilityNotFoundError();
    }
    throw new LiabilityVersionConflictError();
  }

  return mapRowToLiability(updated);
}

export async function findLiabilityRepaymentById(
  householdId: string,
  id: string,
): Promise<LiabilityRepayment | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(liabilityRepayments)
    .where(
      and(
        eq(liabilityRepayments.householdId, householdId),
        eq(liabilityRepayments.id, id),
      ),
    )
    .limit(1);

  if (!row) return null;
  return mapRowToLiabilityRepayment(row);
}

export async function listLiabilityRepaymentsByHousehold(
  householdId: string,
  liabilityId: string,
  options: { includeVoided?: boolean } = { includeVoided: true },
): Promise<LiabilityRepayment[]> {
  const db = getDb();
  const conditions = [
    eq(liabilityRepayments.householdId, householdId),
    eq(liabilityRepayments.liabilityId, liabilityId),
  ];
  if (!options.includeVoided) {
    conditions.push(isNull(liabilityRepayments.voidedAt));
  }

  const rows = await db
    .select()
    .from(liabilityRepayments)
    .where(and(...conditions))
    .orderBy(desc(liabilityRepayments.paidAt), desc(liabilityRepayments.createdAt));

  return rows.map(mapRowToLiabilityRepayment);
}

export async function recordLiabilityRepaymentInDb(params: {
  householdId: string;
  repayment: LiabilityRepayment;
  cashTransaction?: Transaction;
  auditActor?: TransactionAuditActor;
}): Promise<{ repayment: LiabilityRepayment; transaction: Transaction | null }> {
  return await getDb().transaction(async (dbTx) => {
    // 1. Verify liability belongs to household
    // Serialize relationship writes within the household, including retries
    // against different liabilities pointing at the same canonical payment.
    await dbTx.select({ id: households.id }).from(households)
      .where(eq(households.id, params.householdId)).for("update");
    const rep = params.repayment;
    if (rep.householdId !== params.householdId || (params.cashTransaction && rep.transactionId && rep.transactionId !== params.cashTransaction.id)) {
      throw new LiabilityRepaymentVersionConflictError("Invalid repayment transaction relationship");
    }
    const [liabilityRow] = await dbTx
      .select({ id: liabilities.id, currency: liabilities.currency })
      .from(liabilities)
      .where(
        and(
          eq(liabilities.householdId, params.householdId),
          eq(liabilities.id, params.repayment.liabilityId),
        ),
      )
      .limit(1);

    if (!liabilityRow) {
      throw new LiabilityNotFoundError(
        `Liability ${params.repayment.liabilityId} not found in household`,
      );
    }

    if (liabilityRow.currency !== rep.amount.currency) {
      throw new LiabilityDestinationAccountCurrencyMismatchError();
    }
    if (params.cashTransaction &&
      (params.cashTransaction.householdId !== params.householdId ||
        params.cashTransaction.voidedAt !== null ||
        params.cashTransaction.amount.currency !== rep.amount.currency ||
        params.cashTransaction.amount.amountMinor !== rep.amount.amountMinor)) {
      throw new LiabilityRepaymentVersionConflictError("Repayment submission conflicts with an existing payment");
    }

    if (rep.transactionId && !params.cashTransaction) {
      const [payment] = await dbTx.select().from(transactions).where(and(
        eq(transactions.id, rep.transactionId), eq(transactions.householdId, params.householdId),
      )).for("update");
      if (!payment || payment.voidedAt || payment.kind === "income" || payment.currency !== rep.amount.currency || payment.amountMinor !== rep.amount.amountMinor) {
        throw new LiabilityRepaymentVersionConflictError("Invalid repayment transaction relationship");
      }
      const [linkedBnpl] = await dbTx.select({ id: bnplPurchases.id }).from(bnplPurchases).where(and(
        eq(bnplPurchases.householdId, params.householdId),
        eq(bnplPurchases.transactionId, rep.transactionId),
        isNull(bnplPurchases.voidedAt),
      )).limit(1);
      if (linkedBnpl) {
        throw new LiabilityRepaymentVersionConflictError("Transaction is linked to an active BNPL purchase");
      }
      const [linkedObligation] = await dbTx.select({ id: obligations.id }).from(obligations).where(and(
        eq(obligations.householdId, params.householdId),
        eq(obligations.transactionId, rep.transactionId),
        isNull(obligations.cancelledAt),
      )).limit(1);
      if (linkedObligation) {
        throw new LiabilityRepaymentVersionConflictError("Transaction is linked to an active obligation");
      }
    }
    const existingRepayments = await dbTx.select().from(liabilityRepayments).where(and(
      eq(liabilityRepayments.householdId, params.householdId),
      or(
        eq(liabilityRepayments.id, rep.id),
        rep.transactionId ? and(eq(liabilityRepayments.transactionId, rep.transactionId), isNull(liabilityRepayments.voidedAt)) : undefined,
      ),
    ));
    if (existingRepayments.length > 1) {
      throw new LiabilityRepaymentVersionConflictError("Repayment submission conflicts with an existing payment");
    }
    if (existingRepayments.length === 1) {
      const previous = existingRepayments[0]!;
      let cash: Transaction | null = null;
      let sameCash = false;

      if (!params.cashTransaction) {
        sameCash = previous.ownsTransaction !== true && previous.transactionId === rep.transactionId;
      } else {
        if (previous.ownsTransaction && previous.transactionId && params.cashTransaction.householdId === params.householdId) {
          const [existingCash] = await dbTx.select().from(transactions).where(and(
            eq(transactions.id, previous.transactionId), eq(transactions.householdId, params.householdId),
          )).for("share");

          if (existingCash && !existingCash.voidedAt) {
            cash = mapRowToTransaction(existingCash);
            // The repayment row is the immutable idempotency record. The
            // owned ledger row may be corrected later without making a
            // retry create a second economic event.
            const sameCommonCashIdentity =
              params.cashTransaction.kind === cash.kind &&
              params.cashTransaction.amount.amountMinor === cash.amount.amountMinor &&
              params.cashTransaction.amount.currency === cash.amount.currency &&
              params.cashTransaction.occurredOn.getTime() === cash.occurredOn.getTime() &&
              params.cashTransaction.sourceAccountId === cash.sourceAccountId;
            const sameKindSpecificCashIdentity =
              params.cashTransaction.kind === "expense" && cash.kind === "expense"
                ? params.cashTransaction.accountId === cash.accountId &&
                  params.cashTransaction.payee === cash.payee &&
                  params.cashTransaction.paidByPersonId === cash.paidByPersonId
                : params.cashTransaction.kind === "transfer" && cash.kind === "transfer"
                  ? params.cashTransaction.fromAccountId === cash.fromAccountId &&
                    params.cashTransaction.toAccountId === cash.toAccountId
                  : params.cashTransaction.kind === "income" && cash.kind === "income"
                    ? params.cashTransaction.accountId === cash.accountId &&
                      params.cashTransaction.source === cash.source &&
                      params.cashTransaction.receivedByPersonId === cash.receivedByPersonId
                    : false;
            sameCash = sameCommonCashIdentity && sameKindSpecificCashIdentity;
          }
        }
      }

      const sameRepayment = !previous.voidedAt &&
        previous.liabilityId === rep.liabilityId &&
        previous.currency === rep.amount.currency &&
        previous.amountMinor === rep.amount.amountMinor &&
        previous.paidAt.getTime() === rep.paidAt.getTime() &&
        previous.principalMinor === (rep.principalAmount?.amountMinor ?? null) &&
        previous.interestMinor === (rep.interestAmount?.amountMinor ?? null) &&
        previous.feeMinor === (rep.feeAmount?.amountMinor ?? null) &&
        previous.notes === (rep.notes ?? null);

      if (!sameCash || !sameRepayment) {
        throw new LiabilityRepaymentVersionConflictError("Repayment submission conflicts with an existing payment");
      }
      return { repayment: mapRowToLiabilityRepayment(previous), transaction: cash };
    }

    let insertedTx: Transaction | null = null;

    // 2. If a cash payment transaction is supplied, insert it with audit trail atomically
    if (params.cashTransaction) {
      const tx = params.cashTransaction;
      if (tx.householdId !== params.householdId || tx.voidedAt || tx.amount.currency !== rep.amount.currency || tx.amount.amountMinor !== rep.amount.amountMinor) {
        throw new LiabilityRepaymentVersionConflictError("Invalid repayment cash transaction");
      }
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
        submissionId: null,
        sourceNamespace: "generic_csv",
        sourceAccountId: "",
        authoritativeId: null,
      };

      let values: NewTransactionRow;
      if (tx.kind === "transfer") {
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
      } else if (tx.kind === "expense") {
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
      } else {
        throw new Error("Liability cash repayment transaction must be a transfer or expense");
      }

      const [txRow] = await dbTx
        .insert(transactions)
        .values(values)
        .returning();

      if (!txRow) {
        throw new Error("Failed to insert cash repayment transaction");
      }

      const snapshot = createTransactionAuditSnapshot(tx);
      await dbTx.insert(transactionAuditEntries).values({
        transactionId: txRow.id,
        householdId: txRow.householdId,
        revision: txRow.version,
        operation: "create",
        source: params.auditActor?.source ?? "manual",
        authUserId: params.auditActor?.authUserId ?? null,
        personId: params.auditActor?.personId ?? null,
        beforeState: null,
        afterState: snapshot,
        voidReason: null,
        recordedAt: txRow.createdAt,
      });

      insertedTx = mapRowToTransaction(txRow);
    }

    // 3. Insert repayment record
    const [repRow] = await dbTx
      .insert(liabilityRepayments)
      .values({
        id: rep.id,
        householdId: params.householdId,
        liabilityId: rep.liabilityId,
        transactionId: insertedTx ? insertedTx.id : rep.transactionId,
        ownsTransaction: insertedTx !== null,
        paidAt: rep.paidAt,
        amountMinor: rep.amount.amountMinor,
        currency: rep.amount.currency,
        principalMinor: rep.principalAmount?.amountMinor ?? null,
        interestMinor: rep.interestAmount?.amountMinor ?? null,
        feeMinor: rep.feeAmount?.amountMinor ?? null,
        notes: rep.notes,
        version: rep.version,
        voidedAt: rep.voidedAt ?? null,
        voidReason: rep.voidReason ?? null,
      })
      .returning();

    if (!repRow) {
      throw new Error("Failed to insert liability repayment");
    }

    return {
      repayment: mapRowToLiabilityRepayment(repRow),
      transaction: insertedTx,
    };
  });
}

export async function voidLiabilityRepaymentInDb(params: {
  householdId: string;
  id: string;
  expectedVersion: number;
  voidReason?: string | null;
  voidedAt?: Date;
  auditActor?: TransactionAuditActor;
}): Promise<LiabilityRepayment> {
  const effectiveVoidedAt = params.voidedAt ?? new Date();
  const effectiveVoidReason = params.voidReason?.trim() || null;

  return await getDb().transaction(async (dbTx) => {
    await dbTx.select({ id: households.id }).from(households)
      .where(eq(households.id, params.householdId)).for("update");
    // 1. Fetch repayment
    const [existing] = await dbTx
      .select()
      .from(liabilityRepayments)
      .where(
        and(
          eq(liabilityRepayments.householdId, params.householdId),
          eq(liabilityRepayments.id, params.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new LiabilityRepaymentNotFoundError();
    }
    if (existing.voidedAt !== null) {
      throw new LiabilityRepaymentAlreadyVoidedError();
    }
    if (existing.version !== params.expectedVersion) {
      throw new LiabilityRepaymentVersionConflictError(
        `Repayment was modified concurrently (expected version ${params.expectedVersion}, found ${existing.version})`,
      );
    }

    // A pre-existing imported/manual payment belongs to the ledger, not to
    // this relationship. Voiding its allocation must not erase cash history.
    if (existing.transactionId && existing.ownsTransaction === true) {
      const [existingTx] = await dbTx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, params.householdId),
            eq(transactions.id, existing.transactionId),
          ),
        )
        .limit(1);

      if (existingTx && existingTx.voidedAt === null) {
        const [voidedTx] = await dbTx
          .update(transactions)
          .set({
            voidedAt: effectiveVoidedAt,
            voidReason: effectiveVoidReason ?? "Linked liability repayment voided",
            version: existingTx.version + 1,
            updatedAt: effectiveVoidedAt,
          })
          .where(
            and(
              eq(transactions.householdId, params.householdId),
              eq(transactions.id, existing.transactionId),
              eq(transactions.version, existingTx.version),
            ),
          )
          .returning();

        if (voidedTx) {
          const beforeSnapshot = createTransactionAuditSnapshot(mapRowToTransaction(existingTx));
          const afterTx = mapRowToTransaction(voidedTx);
          const afterSnapshot = createTransactionAuditSnapshot(afterTx);

          await dbTx.insert(transactionAuditEntries).values({
            transactionId: voidedTx.id,
            householdId: voidedTx.householdId,
            revision: voidedTx.version,
            operation: "void",
            source: params.auditActor?.source ?? "manual",
            authUserId: params.auditActor?.authUserId ?? null,
            personId: params.auditActor?.personId ?? null,
            beforeState: beforeSnapshot,
            afterState: afterSnapshot,
            voidReason: voidedTx.voidReason,
            recordedAt: voidedTx.updatedAt,
          });
        } else {
          throw new LiabilityRepaymentVersionConflictError();
        }
      }
    }

    // 3. Void repayment
    const [updatedRep] = await dbTx
      .update(liabilityRepayments)
      .set({
        voidedAt: effectiveVoidedAt,
        voidReason: effectiveVoidReason,
        version: params.expectedVersion + 1,
        updatedAt: effectiveVoidedAt,
      })
      .where(
        and(
          eq(liabilityRepayments.householdId, params.householdId),
          eq(liabilityRepayments.id, params.id),
          eq(liabilityRepayments.version, params.expectedVersion),
        ),
      )
      .returning();

    if (!updatedRep) {
      throw new LiabilityRepaymentVersionConflictError();
    }

    return mapRowToLiabilityRepayment(updatedRep);
  });
}
