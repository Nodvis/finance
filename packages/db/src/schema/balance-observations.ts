import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts, currencyCheck, households, instant } from "./foundation";
import { liabilities } from "./liabilities";
import { financeSchema } from "./namespace";

export const balanceObservationSourceEnum = financeSchema.enum(
  "balance_observation_source",
  ["manual", "imported", "reconciled", "legacy"],
);

export const balanceObservations = financeSchema.table(
  "balance_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: uuid("account_id"),
    liabilityId: uuid("liability_id"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    observedAt: instant("observed_at").notNull(),
    source: balanceObservationSourceEnum("source").default("manual").notNull(),
    note: varchar("note", { length: 280 }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "balance_observations_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "balance_observations_household_liability_fk",
      columns: [table.householdId, table.liabilityId],
      foreignColumns: [liabilities.householdId, liabilities.id],
    }).onDelete("cascade"),
    check(
      "balance_observations_exactly_one_subject",
      sql`(${table.accountId} is not null)::int + (${table.liabilityId} is not null)::int = 1`,
    ),
    check("balance_observations_currency_format", currencyCheck(table.currency)),
    check(
      "balance_observations_liability_amount_non_negative",
      sql`${table.liabilityId} is null or ${table.amountMinor} >= 0`,
    ),
    check("balance_observations_note_length", sql`${table.note} is null or length(${table.note}) <= 280`),
    index("balance_observations_household_observed_at_idx").on(
      table.householdId,
      table.observedAt,
    ),
    index("balance_observations_account_observed_at_idx").on(
      table.accountId,
      table.observedAt,
    ),
    index("balance_observations_liability_observed_at_idx").on(
      table.liabilityId,
      table.observedAt,
    ),
  ],
);
