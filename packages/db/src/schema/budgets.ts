import { and, sql } from "drizzle-orm";
import { bigint, check, date, foreignKey, index, integer, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { currencyCheck, households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const budgets = financeSchema.table("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull(),
  month: date("month", { mode: "string" }).notNull(),
  limitAmountMinor: bigint("limit_amount_minor", { mode: "bigint" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  archivedAt: instant("archived_at"),
  version: integer("version").default(1).notNull(),
  createdAt: instant("created_at").defaultNow().notNull(),
  updatedAt: instant("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("budgets_household_id_id_unique").on(table.householdId, table.id),
  unique("budgets_household_category_month_currency_unique").on(table.householdId, table.categoryId, table.month, table.currency),
  foreignKey({ name: "budgets_household_category_fk", columns: [table.householdId, table.categoryId], foreignColumns: [categories.householdId, categories.id] }).onDelete("restrict"),
  check("budgets_limit_positive", sql`${table.limitAmountMinor} > 0`),
  check("budgets_month_format", sql`${table.month} = date_trunc('month', ${table.month})::date`),
  check("budgets_currency_format", currencyCheck(table.currency)),
  check("budgets_version_positive", sql`${table.version} >= 1`),
  index("budgets_household_month_idx").on(table.householdId, table.month),
]);
