import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { getDb } from "../client";
import { categories } from "../schema/categories";
import { transactions } from "../schema/transactions";

export async function listHouseholdAnalyticsTransactions(householdId: string, from?: Date, to?: Date) {
  return getDb().select({
    id: transactions.id,
    kind: transactions.kind,
    amountMinor: transactions.amountMinor,
    currency: transactions.currency,
    occurredOn: transactions.occurredOn,
    payee: transactions.payee,
    source: transactions.source,
    categoryName: categories.name,
  }).from(transactions).leftJoin(categories, and(eq(categories.id, transactions.categoryId), eq(categories.householdId, householdId))).where(and(
    eq(transactions.householdId, householdId), isNull(transactions.voidedAt),
    or(eq(transactions.kind, "expense"), eq(transactions.kind, "income")),
    from ? gte(transactions.occurredOn, from) : undefined,
    to ? lte(transactions.occurredOn, to) : undefined,
  )).orderBy(asc(transactions.occurredOn));
}
