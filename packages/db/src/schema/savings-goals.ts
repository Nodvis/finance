import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { SAVINGS_GOAL_STATUSES } from "@nodvis/finance-domain";

import { accounts, currencyCheck, households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const savingsGoalStatusEnum = financeSchema.enum(
  "savings_goal_status",
  SAVINGS_GOAL_STATUSES,
);

export const savingsGoals = financeSchema.table(
  "savings_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    targetAmountMinor: bigint("target_amount_minor", {
      mode: "bigint",
    }).notNull(),
    currentAmountMinor: bigint("current_amount_minor", {
      mode: "bigint",
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    targetDate: date("target_date", { mode: "string" }),
    accountId: uuid("account_id"),
    status: savingsGoalStatusEnum("status")
      .default("active")
      .notNull(),
    notes: varchar("notes", { length: 500 }),
    completedAt: instant("completed_at"),
    archivedAt: instant("archived_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("savings_goals_household_id_id_unique").on(
      table.householdId,
      table.id,
    ),
    foreignKey({
      name: "savings_goals_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("set null"),
    check("savings_goals_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "savings_goals_target_amount_positive",
      sql`${table.targetAmountMinor} > 0`,
    ),
    check(
      "savings_goals_current_amount_non_negative",
      sql`${table.currentAmountMinor} >= 0`,
    ),
    check("savings_goals_currency_format", currencyCheck(table.currency)),
    check(
      "savings_goals_notes_length",
      sql`${table.notes} is null or length(${table.notes}) <= 500`,
    ),
    check("savings_goals_version_positive", sql`${table.version} >= 1`),
    index("savings_goals_household_id_idx").on(table.householdId),
    index("savings_goals_account_id_idx").on(table.accountId),
    index("savings_goals_household_status_idx").on(
      table.householdId,
      table.status,
    ),
    index("savings_goals_target_date_idx").on(table.targetDate),
  ],
);
