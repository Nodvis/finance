import { sql } from "drizzle-orm";
import { bigint, check, integer, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const recurringPatternStatusEnum = financeSchema.enum(
  "recurring_pattern_status",
  ["suggested", "confirmed", "dismissed"],
);

export const recurringPatterns = financeSchema.table(
  "recurring_patterns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    patternKey: varchar("pattern_key", { length: 320 }).notNull(),
    kind: varchar("kind", { length: 8 }).notNull(),
    counterparty: varchar("counterparty", { length: 160 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    frequency: varchar("frequency", { length: 8 }).notNull(),
    typicalAmountMinor: bigint("typical_amount_minor", { mode: "bigint" }).notNull(),
    minAmountMinor: bigint("min_amount_minor", { mode: "bigint" }).notNull(),
    maxAmountMinor: bigint("max_amount_minor", { mode: "bigint" }).notNull(),
    firstObservedOn: instant("first_observed_on").notNull(),
    lastObservedOn: instant("last_observed_on").notNull(),
    nextExpectedOn: instant("next_expected_on").notNull(),
    observationCount: integer("observation_count").notNull(),
    status: recurringPatternStatusEnum("status").notNull().default("suggested"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("recurring_patterns_household_key_unique").on(table.householdId, table.patternKey),
    check("recurring_patterns_kind_valid", sql`${table.kind} in ('expense', 'income')`),
    check("recurring_patterns_frequency_valid", sql`${table.frequency} in ('weekly', 'monthly')`),
  ],
);
