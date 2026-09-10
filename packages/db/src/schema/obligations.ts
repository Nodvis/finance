import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { currencyCheck, households, instant } from "./foundation";
import { financeSchema } from "./namespace";
import { transactions } from "./transactions";
import { recurringObligationDefinitions } from "./recurring-obligations";

export const obligations = financeSchema.table(
  "obligations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    notes: varchar("notes", { length: 280 }),
    transactionId: uuid("transaction_id"),
    recurringDefinitionId: uuid("recurring_definition_id"),
    version: integer("version").default(1).notNull(),
    cancelledAt: instant("cancelled_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "obligations_transaction_fk",
      columns: [table.transactionId],
      foreignColumns: [transactions.id],
    }).onDelete("set null"),
    foreignKey({
      name: "obligations_recurring_definition_fk",
      columns: [table.recurringDefinitionId],
      foreignColumns: [recurringObligationDefinitions.id],
    }).onDelete("set null"),
    check("obligations_title_not_blank", sql`length(btrim(${table.title})) > 0`),
    check("obligations_amount_positive", sql`${table.amountMinor} > 0`),
    check("obligations_currency_format", currencyCheck(table.currency)),
    check("obligations_version_positive", sql`${table.version} >= 1`),
    index("obligations_household_id_idx").on(table.householdId),
    index("obligations_due_date_idx").on(table.dueDate),
    index("obligations_household_due_date_idx").on(
      table.householdId,
      table.dueDate,
    ),
    index("obligations_transaction_id_idx").on(table.transactionId),
    index("obligations_recurring_definition_idx").on(table.recurringDefinitionId, table.dueDate),
    uniqueIndex("obligations_recurring_occurrence_unique")
      .on(table.recurringDefinitionId, table.dueDate)
      .where(sql`${table.recurringDefinitionId} is not null and ${table.cancelledAt} is null`),
    index("obligations_household_cancelled_at_idx").on(
      table.householdId,
      table.cancelledAt,
    ),
    uniqueIndex("obligations_active_transaction_unique")
      .on(table.transactionId)
      .where(sql`${table.transactionId} is not null and ${table.cancelledAt} is null`),
  ],
);
