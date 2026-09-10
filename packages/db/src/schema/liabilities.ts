import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  unique,
  uuid,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { LIABILITY_KINDS } from "@nodvis/finance-domain";

import {
  accounts,
  currencyCheck,
  householdMemberships,
  households,
  instant,
} from "./foundation";
import { financeSchema } from "./namespace";
import { transactions } from "./transactions";

export const liabilityKindEnum = financeSchema.enum(
  "liability_kind",
  LIABILITY_KINDS,
);

export const liabilities = financeSchema.table(
  "liabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    kind: liabilityKindEnum("kind").default("loan").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    observedOutstandingMinor: bigint("observed_outstanding_minor", {
      mode: "bigint",
    }),
    observedOutstandingAt: instant("observed_outstanding_at"),
    responsiblePersonId: uuid("responsible_person_id"),
    lender: varchar("lender", { length: 160 }),
    destinationAccountId: uuid("destination_account_id"),
    notes: varchar("notes", { length: 280 }),
    version: integer("version").default(1).notNull(),
    archivedAt: instant("archived_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("liabilities_household_id_id_unique").on(
      table.householdId,
      table.id,
    ),
    foreignKey({
      name: "liabilities_household_responsible_person_fk",
      columns: [table.householdId, table.responsiblePersonId],
      foreignColumns: [
        householdMemberships.householdId,
        householdMemberships.personId,
      ],
    }).onDelete("set null"),
    foreignKey({
      name: "liabilities_household_dest_account_fk",
      columns: [table.householdId, table.destinationAccountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("set null"),
    check("liabilities_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("liabilities_currency_format", currencyCheck(table.currency)),
    check(
      "liabilities_observed_outstanding_complete",
      sql`(${table.observedOutstandingMinor} is null) = (${table.observedOutstandingAt} is null)`,
    ),
    check(
      "liabilities_observed_outstanding_non_negative",
      sql`${table.observedOutstandingMinor} is null or ${table.observedOutstandingMinor} >= 0`,
    ),
    check("liabilities_version_positive", sql`${table.version} >= 1`),
    index("liabilities_household_id_idx").on(table.householdId),
    index("liabilities_responsible_person_id_idx").on(
      table.responsiblePersonId,
    ),
    index("liabilities_destination_account_id_idx").on(
      table.destinationAccountId,
    ),
  ],
);

export const liabilityRepayments = financeSchema.table(
  "liability_repayments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    liabilityId: uuid("liability_id").notNull(),
    transactionId: uuid("transaction_id"),
    // Null means historical ownership is unknown; never infer it during migration.
    ownsTransaction: boolean("owns_transaction"),
    paidAt: instant("paid_at").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    principalMinor: bigint("principal_minor", { mode: "bigint" }),
    interestMinor: bigint("interest_minor", { mode: "bigint" }),
    feeMinor: bigint("fee_minor", { mode: "bigint" }),
    notes: varchar("notes", { length: 280 }),
    version: integer("version").default(1).notNull(),
    voidedAt: instant("voided_at"),
    voidReason: varchar("void_reason", { length: 280 }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "liability_repayments_household_liability_fk",
      columns: [table.householdId, table.liabilityId],
      foreignColumns: [liabilities.householdId, liabilities.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "liability_repayments_tx_fk",
      columns: [table.transactionId],
      foreignColumns: [transactions.id],
    }).onDelete("set null"),
    check(
      "liability_repayments_amount_positive",
      sql`${table.amountMinor} > 0`,
    ),
    check(
      "liability_repayments_currency_format",
      currencyCheck(table.currency),
    ),
    check(
      "liability_repayments_principal_non_negative",
      sql`${table.principalMinor} is null or ${table.principalMinor} >= 0`,
    ),
    check(
      "liability_repayments_interest_non_negative",
      sql`${table.interestMinor} is null or ${table.interestMinor} >= 0`,
    ),
    check(
      "liability_repayments_fee_non_negative",
      sql`${table.feeMinor} is null or ${table.feeMinor} >= 0`,
    ),
    check(
      "liability_repayments_allocation_sum",
      sql`coalesce(${table.principalMinor}, 0) + coalesce(${table.interestMinor}, 0) + coalesce(${table.feeMinor}, 0) <= ${table.amountMinor}`,
    ),
    check(
      "liability_repayments_version_positive",
      sql`${table.version} >= 1`,
    ),
    index("liability_repayments_household_id_idx").on(table.householdId),
    index("liability_repayments_liability_id_idx").on(table.liabilityId),
    index("liability_repayments_transaction_id_idx").on(table.transactionId),
    uniqueIndex("liability_repayments_active_transaction_unique").on(table.transactionId).where(sql`${table.transactionId} is not null and ${table.voidedAt} is null`),
    index("liability_repayments_paid_at_idx").on(table.paidAt),
    index("liability_repayments_household_paid_at_idx").on(
      table.householdId,
      table.paidAt,
    ),
  ],
);
