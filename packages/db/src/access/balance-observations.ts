import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { AccountType } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { balanceObservations } from "../schema/balance-observations";
import { accounts } from "../schema/foundation";
import { liabilities } from "../schema/liabilities";
import { AccountNotFoundError } from "./accounts";
import { LiabilityNotFoundError } from "./liabilities";

export type BalanceObservationSource = "manual" | "imported" | "reconciled" | "legacy";

export type BalanceObservationRecord = {
  id: string;
  householdId: string;
  accountId: string | null;
  liabilityId: string | null;
  subjectName?: string | null;
  subjectKind?: "account" | "liability";
  accountType: AccountType | null;
  amountMinor: bigint;
  currency: string;
  observedAt: Date;
  source: BalanceObservationSource;
  note: string | null;
  createdAt: Date;
};

export async function recordAccountBalanceObservation(input: {
  householdId: string;
  accountId: string;
  amountMinor: bigint;
  currency: string;
  observedAt: Date;
  source?: BalanceObservationSource | undefined;
  note?: string | null | undefined;
}): Promise<BalanceObservationRecord> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [account] = await tx
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        balanceSnapshotAt: accounts.balanceSnapshotAt,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, input.householdId),
          eq(accounts.id, input.accountId),
        ),
      )
      .limit(1);

    if (!account) {
      throw new AccountNotFoundError(`Account ${input.accountId} not found in household`);
    }

    if (account.currency !== input.currency) {
      throw new Error(
        `Currency mismatch: account currency is ${account.currency}, observation currency is ${input.currency}`,
      );
    }

    if (Number.isNaN(input.observedAt.getTime())) {
      throw new Error("Invalid observation date");
    }

    const [row] = await tx
      .insert(balanceObservations)
      .values({
        householdId: input.householdId,
        accountId: input.accountId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        observedAt: input.observedAt,
        source: input.source ?? "manual",
        note: input.note ?? null,
      })
      .returning();

    if (!row) throw new Error("Failed to record account balance observation");

    // Preserve existing snapshot semantics: update account snapshot if this observation is newer or equal
    if (!account.balanceSnapshotAt || input.observedAt >= account.balanceSnapshotAt) {
      await tx
        .update(accounts)
        .set({
          balanceSnapshotMinor: input.amountMinor,
          balanceSnapshotAt: input.observedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accounts.householdId, input.householdId),
            eq(accounts.id, input.accountId),
          ),
        );
    }

    return {
      id: row.id,
      householdId: row.householdId,
      accountId: row.accountId,
      liabilityId: row.liabilityId,
      subjectName: account.name,
      subjectKind: "account",
      accountType: account.type as AccountType,
      amountMinor: BigInt(row.amountMinor),
      currency: row.currency,
      observedAt: row.observedAt,
      source: row.source as BalanceObservationSource,
      note: row.note,
      createdAt: row.createdAt,
    };
  });
}

export async function recordLiabilityBalanceObservation(input: {
  householdId: string;
  liabilityId: string;
  amountMinor: bigint;
  currency: string;
  observedAt: Date;
  source?: BalanceObservationSource | undefined;
  note?: string | null | undefined;
}): Promise<BalanceObservationRecord> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [liability] = await tx
      .select({
        id: liabilities.id,
        name: liabilities.name,
        currency: liabilities.currency,
        observedOutstandingAt: liabilities.observedOutstandingAt,
      })
      .from(liabilities)
      .where(
        and(
          eq(liabilities.householdId, input.householdId),
          eq(liabilities.id, input.liabilityId),
        ),
      )
      .limit(1);

    if (!liability) {
      throw new LiabilityNotFoundError(`Liability ${input.liabilityId} not found in household`);
    }

    if (liability.currency !== input.currency) {
      throw new Error(
        `Currency mismatch: liability currency is ${liability.currency}, observation currency is ${input.currency}`,
      );
    }

    if (input.amountMinor < 0n) {
      throw new Error("Liability balance observation cannot be negative");
    }

    if (Number.isNaN(input.observedAt.getTime())) {
      throw new Error("Invalid observation date");
    }

    const [row] = await tx
      .insert(balanceObservations)
      .values({
        householdId: input.householdId,
        liabilityId: input.liabilityId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        observedAt: input.observedAt,
        source: input.source ?? "manual",
        note: input.note ?? null,
      })
      .returning();

    if (!row) throw new Error("Failed to record liability balance observation");

    // Preserve existing snapshot semantics: update liability snapshot if this observation is newer or equal
    if (!liability.observedOutstandingAt || input.observedAt >= liability.observedOutstandingAt) {
      await tx
        .update(liabilities)
        .set({
          observedOutstandingMinor: input.amountMinor,
          observedOutstandingAt: input.observedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(liabilities.householdId, input.householdId),
            eq(liabilities.id, input.liabilityId),
          ),
        );
    }

    return {
      id: row.id,
      householdId: row.householdId,
      accountId: row.accountId,
      liabilityId: row.liabilityId,
      subjectName: liability.name,
      subjectKind: "liability",
      accountType: null,
      amountMinor: BigInt(row.amountMinor),
      currency: row.currency,
      observedAt: row.observedAt,
      source: row.source as BalanceObservationSource,
      note: row.note,
      createdAt: row.createdAt,
    };
  });
}

/**
 * Returns one latest observation per active account/liability at or before `asOf`.
 * Missing or future observations are deliberately omitted so callers can
 * communicate incomplete historical precision instead of fabricating values.
 */
export async function listLatestBalanceObservations(
  householdId: string,
  asOf: Date,
  options?: { includeArchived?: boolean },
): Promise<BalanceObservationRecord[]> {
  const db = getDb();
  const includeArchived = options?.includeArchived ?? false;

  const rows = await db
    .select({
      id: balanceObservations.id,
      householdId: balanceObservations.householdId,
      accountId: balanceObservations.accountId,
      liabilityId: balanceObservations.liabilityId,
      accountName: accounts.name,
      accountType: accounts.type,
      accountArchivedAt: accounts.archivedAt,
      liabilityName: liabilities.name,
      liabilityArchivedAt: liabilities.archivedAt,
      amountMinor: balanceObservations.amountMinor,
      currency: balanceObservations.currency,
      observedAt: balanceObservations.observedAt,
      source: balanceObservations.source,
      note: balanceObservations.note,
      createdAt: balanceObservations.createdAt,
    })
    .from(balanceObservations)
    .leftJoin(
      accounts,
      and(
        eq(balanceObservations.householdId, accounts.householdId),
        eq(balanceObservations.accountId, accounts.id),
      ),
    )
    .leftJoin(
      liabilities,
      and(
        eq(balanceObservations.householdId, liabilities.householdId),
        eq(balanceObservations.liabilityId, liabilities.id),
      ),
    )
    .where(
      and(
        eq(balanceObservations.householdId, householdId),
        lte(balanceObservations.observedAt, asOf),
        or(
          eq(balanceObservations.accountId, accounts.id),
          eq(balanceObservations.liabilityId, liabilities.id),
        ),
      ),
    )
    .orderBy(desc(balanceObservations.observedAt), desc(balanceObservations.createdAt));

  const latest = new Map<string, BalanceObservationRecord>();
  for (const row of rows) {
    // Exclude archived subjects if requested
    if (!includeArchived) {
      if (row.accountId && row.accountArchivedAt !== null) continue;
      if (row.liabilityId && row.liabilityArchivedAt !== null) continue;
    }

    const subjectKey = row.accountId
      ? `account:${row.accountId}`
      : `liability:${row.liabilityId}`;
    if (latest.has(subjectKey)) continue;

    latest.set(subjectKey, {
      id: row.id,
      householdId: row.householdId,
      accountId: row.accountId,
      liabilityId: row.liabilityId,
      subjectName: row.accountName ?? row.liabilityName ?? null,
      subjectKind: row.accountId ? "account" : "liability",
      amountMinor: BigInt(row.amountMinor),
      accountType: row.accountType as AccountType | null,
      currency: row.currency,
      observedAt: row.observedAt,
      source: row.source as BalanceObservationSource,
      note: row.note,
      createdAt: row.createdAt,
    });
  }

  return Array.from(latest.values()).sort((left, right) =>
    left.observedAt.getTime() - right.observedAt.getTime(),
  );
}

/**
 * Lists all balance observations for a household with optional filters.
 */
export async function listHouseholdBalanceObservations(
  householdId: string,
  options?: {
    from?: Date | undefined;
    to?: Date | undefined;
    accountId?: string | undefined;
    liabilityId?: string | undefined;
    limit?: number | undefined;
  },
): Promise<BalanceObservationRecord[]> {
  const db = getDb();
  const conditions = [eq(balanceObservations.householdId, householdId)];

  if (options?.from) {
    conditions.push(gte(balanceObservations.observedAt, options.from));
  }
  if (options?.to) {
    conditions.push(lte(balanceObservations.observedAt, options.to));
  }
  if (options?.accountId) {
    conditions.push(eq(balanceObservations.accountId, options.accountId));
  }
  if (options?.liabilityId) {
    conditions.push(eq(balanceObservations.liabilityId, options.liabilityId));
  }

  const query = db
    .select({
      id: balanceObservations.id,
      householdId: balanceObservations.householdId,
      accountId: balanceObservations.accountId,
      liabilityId: balanceObservations.liabilityId,
      accountName: accounts.name,
      accountType: accounts.type,
      liabilityName: liabilities.name,
      amountMinor: balanceObservations.amountMinor,
      currency: balanceObservations.currency,
      observedAt: balanceObservations.observedAt,
      source: balanceObservations.source,
      note: balanceObservations.note,
      createdAt: balanceObservations.createdAt,
    })
    .from(balanceObservations)
    .leftJoin(
      accounts,
      and(
        eq(balanceObservations.householdId, accounts.householdId),
        eq(balanceObservations.accountId, accounts.id),
      ),
    )
    .leftJoin(
      liabilities,
      and(
        eq(balanceObservations.householdId, liabilities.householdId),
        eq(balanceObservations.liabilityId, liabilities.id),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(balanceObservations.observedAt), desc(balanceObservations.createdAt));

  const rows = options?.limit ? await query.limit(options.limit) : await query;

  return rows.map((row) => ({
    id: row.id,
    householdId: row.householdId,
    accountId: row.accountId,
    liabilityId: row.liabilityId,
    subjectName: row.accountName ?? row.liabilityName ?? null,
    subjectKind: row.accountId ? "account" : "liability",
    accountType: (row.accountType as AccountType | null) ?? null,
    amountMinor: BigInt(row.amountMinor),
    currency: row.currency,
    observedAt: row.observedAt,
    source: row.source as BalanceObservationSource,
    note: row.note,
    createdAt: row.createdAt,
  }));
}

/**
 * Lists observations for a specific account or liability, validating that the subject
 * belongs to the specified household.
 */
export async function listBalanceObservationsForSubject(input: {
  householdId: string;
  accountId?: string;
  liabilityId?: string;
}): Promise<BalanceObservationRecord[]> {
  const db = getDb();

  if (input.accountId) {
    const [account] = await db
      .select({ id: accounts.id, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, input.householdId),
          eq(accounts.id, input.accountId),
        ),
      )
      .limit(1);

    if (!account) {
      throw new AccountNotFoundError(`Account ${input.accountId} not found in household`);
    }

    const rows = await db
      .select()
      .from(balanceObservations)
      .where(
        and(
          eq(balanceObservations.householdId, input.householdId),
          eq(balanceObservations.accountId, input.accountId),
        ),
      )
      .orderBy(desc(balanceObservations.observedAt), desc(balanceObservations.createdAt));

    return rows.map((row) => ({
      id: row.id,
      householdId: row.householdId,
      accountId: row.accountId,
      liabilityId: row.liabilityId,
      subjectName: account.name,
      subjectKind: "account",
      accountType: account.type as AccountType,
      amountMinor: BigInt(row.amountMinor),
      currency: row.currency,
      observedAt: row.observedAt,
      source: row.source as BalanceObservationSource,
      note: row.note,
      createdAt: row.createdAt,
    }));
  }

  if (input.liabilityId) {
    const [liability] = await db
      .select({ id: liabilities.id, name: liabilities.name })
      .from(liabilities)
      .where(
        and(
          eq(liabilities.householdId, input.householdId),
          eq(liabilities.id, input.liabilityId),
        ),
      )
      .limit(1);

    if (!liability) {
      throw new LiabilityNotFoundError(`Liability ${input.liabilityId} not found in household`);
    }

    const rows = await db
      .select()
      .from(balanceObservations)
      .where(
        and(
          eq(balanceObservations.householdId, input.householdId),
          eq(balanceObservations.liabilityId, input.liabilityId),
        ),
      )
      .orderBy(desc(balanceObservations.observedAt), desc(balanceObservations.createdAt));

    return rows.map((row) => ({
      id: row.id,
      householdId: row.householdId,
      accountId: row.accountId,
      liabilityId: row.liabilityId,
      subjectName: liability.name,
      subjectKind: "liability",
      accountType: null,
      amountMinor: BigInt(row.amountMinor),
      currency: row.currency,
      observedAt: row.observedAt,
      source: row.source as BalanceObservationSource,
      note: row.note,
      createdAt: row.createdAt,
    }));
  }

  throw new Error("An account or liability subject is required");
}
