import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { households } from "./foundation";
import { financeSchema } from "./namespace";
import { transactions } from "./transactions";

export const transactionSplitAllocations = financeSchema.table("transaction_split_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id").notNull(),
  categoryId: uuid("category_id").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
}, (table) => [
  foreignKey({ name: "split_household_transaction_fk", columns: [table.householdId, table.transactionId], foreignColumns: [transactions.householdId, transactions.id] }).onDelete("cascade"),
  foreignKey({ name: "split_household_category_fk", columns: [table.householdId, table.categoryId], foreignColumns: [categories.householdId, categories.id] }).onDelete("restrict"),
  check("split_amount_positive", sql`${table.amountMinor} > 0`),
  check("split_currency_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  uniqueIndex("split_transaction_category_unique").on(table.householdId, table.transactionId, table.categoryId),
  index("split_household_transaction_idx").on(table.householdId, table.transactionId),
  index("split_household_category_idx").on(table.householdId, table.categoryId),
]);
