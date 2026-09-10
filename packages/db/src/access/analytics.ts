import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { getDb } from "../client";
import { categories } from "../schema/categories";
import { transactions } from "../schema/transactions";
import { economicAmountMinor, economicKind } from "./financial-reporting";

export async function listHouseholdAnalyticsTransactions(householdId: string, from?: Date, to?: Date) {
  return getDb().select({
    id: transactions.id,
    kind: economicKind,
    amountMinor: sql`${economicAmountMinor}`.mapWith(BigInt),
    currency: transactions.currency,
    occurredOn: transactions.occurredOn,
    payee: transactions.payee,
    source: transactions.source,
    categoryName: categories.name,
  }).from(transactions).leftJoin(categories, and(eq(categories.id, transactions.categoryId), eq(categories.householdId, householdId))).where(and(
    eq(transactions.householdId, householdId), isNull(transactions.voidedAt),
    sql`${economicAmountMinor} > 0`,
    from ? gte(transactions.occurredOn, from) : undefined,
    to ? lte(transactions.occurredOn, to) : undefined,
  )).orderBy(asc(transactions.occurredOn));
}
