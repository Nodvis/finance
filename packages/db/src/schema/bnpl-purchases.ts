import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  BNPL_PAYMENT_MODELS,
  BNPL_PURCHASE_STATUSES,
} from "@nodvis/finance-domain";

import { creditFacilities } from "./credit-facilities";
import { currencyCheck, households, instant } from "./foundation";
import { financeSchema } from "./namespace";
import { transactions } from "./transactions";

export const bnplPaymentModelEnum = financeSchema.enum(
  "bnpl_payment_model",
  BNPL_PAYMENT_MODELS,
);

export const bnplPurchaseStatusEnum = financeSchema.enum(
  "bnpl_purchase_status",
  BNPL_PURCHASE_STATUSES,
);

export const bnplPurchases = financeSchema.table(
  "bnpl_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    creditFacilityId: uuid("credit_facility_id").notNull(),
    provider: varchar("provider", { length: 160 }).notNull(),
    product: varchar("product", { length: 160 }).notNull(),
    merchant: varchar("merchant", { length: 160 }).notNull(),
    description: varchar("description", { length: 280 }),
    purchaseDate: instant("purchase_date").notNull(),
    financingDate: instant("financing_date").notNull(),
    originalAmountMinor: bigint("original_amount_minor", {
      mode: "bigint",
    }).notNull(),
    financedAmountMinor: bigint("financed_amount_minor", {
      mode: "bigint",
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    observedOutstandingMinor: bigint("observed_outstanding_minor", {
      mode: "bigint",
    }),
    observedOutstandingAt: instant("observed_outstanding_at"),
    paymentModel: bnplPaymentModelEnum("payment_model")
      .default("pay_in_30")
      .notNull(),
    status: bnplPurchaseStatusEnum("status")
      .default("active")
      .notNull(),
    dueDate: instant("due_date"),
    principalMinor: bigint("principal_minor", { mode: "bigint" }),
    interestMinor: bigint("interest_minor", { mode: "bigint" }),
    feeMinor: bigint("fee_minor", { mode: "bigint" }),
    transactionId: uuid("transaction_id"),
    version: integer("version").default(1).notNull(),
    voidedAt: instant("voided_at"),
    voidReason: varchar("void_reason", { length: 280 }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("bnpl_purchases_household_id_id_unique").on(
      table.householdId,
      table.id,
    ),
    foreignKey({
      name: "bnpl_purchases_household_credit_facility_fk",
      columns: [table.householdId, table.creditFacilityId],
      foreignColumns: [creditFacilities.householdId, creditFacilities.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "bnpl_purchases_transaction_fk",
      columns: [table.transactionId],
      foreignColumns: [transactions.id],
    }).onDelete("set null"),
    check(
      "bnpl_purchases_provider_not_blank",
      sql`length(btrim(${table.provider})) > 0`,
    ),
    check(
      "bnpl_purchases_product_not_blank",
      sql`length(btrim(${table.product})) > 0`,
    ),
    check(
      "bnpl_purchases_merchant_not_blank",
      sql`length(btrim(${table.merchant})) > 0`,
    ),
    check("bnpl_purchases_currency_format", currencyCheck(table.currency)),
    check(
      "bnpl_purchases_original_amount_positive",
      sql`${table.originalAmountMinor} > 0`,
    ),
    check(
      "bnpl_purchases_financed_amount_positive",
      sql`${table.financedAmountMinor} > 0`,
    ),
    check(
      "bnpl_purchases_observed_outstanding_complete",
      sql`(${table.observedOutstandingMinor} is null) = (${table.observedOutstandingAt} is null)`,
    ),
    check(
      "bnpl_purchases_observed_outstanding_non_negative",
      sql`${table.observedOutstandingMinor} is null or ${table.observedOutstandingMinor} >= 0`,
    ),
    check(
      "bnpl_purchases_principal_non_negative",
      sql`${table.principalMinor} is null or ${table.principalMinor} >= 0`,
    ),
    check(
      "bnpl_purchases_interest_non_negative",
      sql`${table.interestMinor} is null or ${table.interestMinor} >= 0`,
    ),
    check(
      "bnpl_purchases_fee_non_negative",
      sql`${table.feeMinor} is null or ${table.feeMinor} >= 0`,
    ),
    check("bnpl_purchases_version_positive", sql`${table.version} >= 1`),
    index("bnpl_purchases_household_id_idx").on(table.householdId),
    index("bnpl_purchases_credit_facility_id_idx").on(table.creditFacilityId),
    index("bnpl_purchases_transaction_id_idx").on(table.transactionId),
    uniqueIndex("bnpl_purchases_active_transaction_unique").on(table.transactionId).where(sql`${table.transactionId} is not null and ${table.voidedAt} is null`),
    index("bnpl_purchases_purchase_date_idx").on(table.purchaseDate),
    index("bnpl_purchases_due_date_idx").on(table.dueDate),
    index("bnpl_purchases_household_status_idx").on(
      table.householdId,
      table.status,
    ),
  ],
);
