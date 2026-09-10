import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, uuid, varchar } from "drizzle-orm/pg-core";

import { currencyCheck, households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const recurringObligationDefinitions = financeSchema.table(
  "recurring_obligation_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    frequency: varchar("frequency", { length: 7 }).notNull(),
    firstDueDate: date("first_due_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    notes: varchar("notes", { length: 280 }),
    version: integer("version").default(1).notNull(),
    cancelledAt: instant("cancelled_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("recurring_definitions_title_not_blank", sql`length(btrim(${table.title})) > 0`),
    check("recurring_definitions_amount_positive", sql`${table.amountMinor} > 0`),
    check("recurring_definitions_currency_format", currencyCheck(table.currency)),
    check("recurring_definitions_frequency_valid", sql`${table.frequency} in ('weekly', 'monthly', 'yearly')`),
    check("recurring_definitions_date_range_valid", sql`${table.endDate} is null or ${table.endDate} >= ${table.firstDueDate}`),
    check("recurring_definitions_version_positive", sql`${table.version} >= 1`),
    index("recurring_definitions_household_idx").on(table.householdId),
    index("recurring_definitions_active_idx").on(table.householdId, table.cancelledAt),
  ],
);
