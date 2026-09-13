import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm/alias";

import { getDb } from "../client";
import { categories } from "../schema/categories";
import { transactions } from "../schema/transactions";
import { transactionSplitAllocations } from "../schema/transaction-splits";
import { economicAmountMinor, economicKind } from "./financial-reporting";

const splitCategories = aliasedTable(categories, "split_categories");

export async function listHouseholdAnalyticsTransactions(householdId: string, from?: Date, to?: Date) {
  return getDb().select({
    id: transactions.id,
    kind: economicKind,
    amountMinor: sql`${economicAmountMinor}`.mapWith(BigInt),
    allocationAmountMinor: sql`coalesce(${transactionSplitAllocations.amountMinor}, ${economicAmountMinor})`.mapWith(BigInt),
    currency: transactions.currency,
    occurredOn: transactions.occurredOn,
    payee: transactions.payee,
    source: transactions.source,
    categoryName: sql<string | null>`case when ${transactionSplitAllocations.id} is not null then ${splitCategories.name} else ${categories.name} end`,
    isSplit: sql<boolean>`${transactionSplitAllocations.id} is not null`,
  }).from(transactions).leftJoin(categories, and(eq(categories.id, transactions.categoryId), eq(categories.householdId, householdId))).leftJoin(transactionSplitAllocations, and(eq(transactionSplitAllocations.householdId, transactions.householdId), eq(transactionSplitAllocations.transactionId, transactions.id), eq(transactionSplitAllocations.currency, transactions.currency))).leftJoin(splitCategories, and(eq(splitCategories.id, transactionSplitAllocations.categoryId), eq(splitCategories.householdId, householdId))).where(and(
    eq(transactions.householdId, householdId), isNull(transactions.voidedAt),
    sql`${economicAmountMinor} > 0`,
    from ? gte(transactions.occurredOn, from) : undefined,
    to ? lte(transactions.occurredOn, to) : undefined,
  )).orderBy(asc(transactions.occurredOn));
}
