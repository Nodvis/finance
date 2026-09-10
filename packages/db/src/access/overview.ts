import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { ACCOUNT_TYPES } from "@nodvis/finance-domain";

import { getDb } from "../client";
import { accounts } from "../schema/foundation";
import { categories } from "../schema/categories";
import { transactions } from "../schema/transactions";
import { economicAmountMinor, economicKind } from "./financial-reporting";

export type DbPeriodCashFlowRow = {
  kind: "expense" | "income";
  currency: string;
  totalMinor: bigint;
  transactionCount: number;
};

export type DbCategorySpendingRow = {
  categoryId: string | null;
  categoryName: string | null;
  currency: string;
  totalMinor: bigint;
  transactionCount: number;
};

export type DbAssetAccountRow = {
  id: string;
  householdId: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  currency: string;
  balanceSnapshotMinor: bigint | null;
  balanceSnapshotAt: Date | null;
};

/**
 * Executes exact SQL aggregation for income and spending within a period for a household.
 *
 * Excludes:
 * - Voided transactions (`voided_at IS NOT NULL`)
 * - Internal transfers (`kind = 'transfer'`)
 *
 * Enforces household authorization at the database boundary.
 */
export async function getHouseholdPeriodCashFlow(params: {
  householdId: string;
  startDate: Date;
  endDate: Date;
}): Promise<DbPeriodCashFlowRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      kind: economicKind,
      currency: transactions.currency,
      totalMinor: sql<string>`coalesce(sum(${economicAmountMinor}), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, params.householdId),
        isNull(transactions.voidedAt),
        sql`${economicAmountMinor} > 0`,
        gte(transactions.occurredOn, params.startDate),
        lte(transactions.occurredOn, params.endDate),
      ),
    )
    .groupBy(economicKind, transactions.currency);

  return rows.map((r) => ({
    kind: r.kind as "expense" | "income",
    currency: r.currency,
    totalMinor: BigInt(r.totalMinor ?? "0"),
    transactionCount: Number(r.transactionCount ?? 0),
  }));
}

/**
 * Executes exact SQL aggregation for spending grouped by category for a period.
 *
 * - Only includes active expense transactions.
 * - Excludes transfers and voided records.
 * - Handles uncategorized expenses (categoryId is null).
 */
export async function getHouseholdPeriodCategorySpending(params: {
  householdId: string;
  startDate: Date;
  endDate: Date;
}): Promise<DbCategorySpendingRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      currency: transactions.currency,
      totalMinor: sql<string>`coalesce(sum(${economicAmountMinor}), 0)`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .leftJoin(
      categories,
      and(
        eq(transactions.categoryId, categories.id),
        eq(categories.householdId, params.householdId),
      ),
    )
    .where(
      and(
        eq(transactions.householdId, params.householdId),
        isNull(transactions.voidedAt),
        sql`${economicKind} = 'expense' and ${economicAmountMinor} > 0`,
        gte(transactions.occurredOn, params.startDate),
        lte(transactions.occurredOn, params.endDate),
      ),
    )
    .groupBy(
      transactions.categoryId,
      categories.name,
      transactions.currency,
    )
    .orderBy(desc(sql`coalesce(sum(${economicAmountMinor}), 0)`));

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    currency: r.currency,
    totalMinor: BigInt(r.totalMinor ?? "0"),
    transactionCount: Number(r.transactionCount ?? 0),
  }));
}

/**
 * Queries active asset accounts for a household without joining account_owners,
 * ensuring shared accounts with multiple owners are counted exactly once.
 */
export async function getHouseholdEligibleAccounts(
  householdId: string,
): Promise<DbAssetAccountRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: accounts.id,
      householdId: accounts.householdId,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      balanceSnapshotMinor: accounts.balanceSnapshotMinor,
      balanceSnapshotAt: accounts.balanceSnapshotAt,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        isNull(accounts.archivedAt),
      ),
    )
    .orderBy(asc(accounts.name));

  return rows.map((r) => ({
    ...r,
    balanceSnapshotMinor:
      r.balanceSnapshotMinor !== null
        ? BigInt(r.balanceSnapshotMinor)
        : null,
  }));
}
