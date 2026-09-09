import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  bigint,
  unique,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

import { CREDIT_FACILITY_KINDS } from "@nodvis/finance-domain";

import { accounts, currencyCheck, households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const creditFacilityKindEnum = financeSchema.enum(
  "credit_facility_kind",
  CREDIT_FACILITY_KINDS,
);

export const creditFacilities = financeSchema.table(
  "credit_facilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: uuid("account_id"),
    kind: creditFacilityKindEnum("kind").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    approvedLimitMinor: bigint("approved_limit_minor", { mode: "bigint" }),
    observedUsedMinor: bigint("observed_used_minor", { mode: "bigint" }),
    observedAvailableMinor: bigint("observed_available_minor", { mode: "bigint" }),
    observedAt: instant("observed_at"),
    effectiveFrom: instant("effective_from"),
    expiresAt: instant("expires_at"),
    version: integer("version").default(1).notNull(),
    archivedAt: instant("archived_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("credit_facilities_household_account_kind_unique").on(
      table.householdId,
      table.accountId,
      table.kind,
    ),
    foreignKey({
      name: "credit_facilities_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("set null"),
    check("credit_facilities_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("credit_facilities_currency_format", currencyCheck(table.currency)),
    check("credit_facilities_limit_non_negative", sql`${table.approvedLimitMinor} is null or ${table.approvedLimitMinor} >= 0`),
    check("credit_facilities_used_non_negative", sql`${table.observedUsedMinor} is null or ${table.observedUsedMinor} >= 0`),
    check("credit_facilities_available_non_negative", sql`${table.observedAvailableMinor} is null or ${table.observedAvailableMinor} >= 0`),
    check("credit_facilities_observation_complete", sql`(${table.observedAt} is null) = (${table.observedUsedMinor} is null and ${table.observedAvailableMinor} is null)`),
    check("credit_facilities_overdraft_has_account", sql`${table.kind} <> 'overdraft' or ${table.accountId} is not null`),
    check("credit_facilities_dates_ordered", sql`${table.expiresAt} is null or ${table.effectiveFrom} is null or ${table.expiresAt} >= ${table.effectiveFrom}`),
    check("credit_facilities_version_positive", sql`${table.version} >= 1`),
    index("credit_facilities_household_id_idx").on(table.householdId),
    index("credit_facilities_account_id_idx").on(table.accountId),
  ],
);
