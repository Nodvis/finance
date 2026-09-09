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

    let insertedTx: Transaction | null = null;

    // 2. If a cash payment transaction is supplied, insert it with audit trail atomically
    if (params.cashTransaction) {
      const tx = params.cashTransaction;
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
    const rep = params.repayment;
    const [repRow] = await dbTx
      .insert(liabilityRepayments)
      .values({
        id: rep.id,
        householdId: params.householdId,
        liabilityId: rep.liabilityId,
        transactionId: insertedTx ? insertedTx.id : rep.transactionId,
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

    // 2. Void linked transaction if present
    if (existing.transactionId) {
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
