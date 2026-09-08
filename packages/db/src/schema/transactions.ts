import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  TRANSACTION_AUDIT_OPERATIONS,
  TRANSACTION_AUDIT_SOURCES,
  TRANSACTION_KINDS,
} from "@nodvis/finance-domain";
import type { TransactionAuditSnapshot } from "@nodvis/finance-domain";

import { authUsers } from "./auth";
import {
  accounts,
  currencyCheck,
  householdMemberships,
  households,
  instant,
  persons,
} from "./foundation";
import { categories } from "./categories";
import { financeSchema } from "./namespace";

export const transactionKindEnum = financeSchema.enum(
  "transaction_kind",
  TRANSACTION_KINDS,
);

export const transactionAuditOperationEnum = financeSchema.enum(
  "transaction_audit_operation",
  TRANSACTION_AUDIT_OPERATIONS,
);

export const transactionAuditSourceEnum = financeSchema.enum(
  "transaction_audit_source",
  TRANSACTION_AUDIT_SOURCES,
);


export const transactions = financeSchema.table(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    kind: transactionKindEnum("kind").notNull(),
    amountMinor: bigint("amount_minor", {
      mode: "bigint",
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    occurredOn: instant("occurred_on").notNull(),

    // Expense / Income single account
    accountId: uuid("account_id"),

    // Optional category (Expense / Income)
    categoryId: uuid("category_id"),

    // Expense context
    payee: varchar("payee", { length: 160 }),
    paidByPersonId: uuid("paid_by_person_id"),

    // Income context
    source: varchar("source", { length: 160 }),
    receivedByPersonId: uuid("received_by_person_id"),

    // Transfer context
    fromAccountId: uuid("from_account_id"),
    toAccountId: uuid("to_account_id"),

    // Audit and correction tracking
    version: integer("version").notNull().default(1),
    voidedAt: instant("voided_at"),
    voidReason: varchar("void_reason", { length: 280 }),

    // Idempotency / duplicate submission protection at boundary
    submissionId: varchar("submission_id", { length: 64 }),

    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "transactions_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "transactions_household_category_fk",
      columns: [table.householdId, table.categoryId],
      foreignColumns: [categories.householdId, categories.id],
    }).onDelete("set null"),
    foreignKey({
      name: "transactions_household_from_account_fk",
      columns: [table.householdId, table.fromAccountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "transactions_household_to_account_fk",
      columns: [table.householdId, table.toAccountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "transactions_household_paid_by_person_fk",
      columns: [table.householdId, table.paidByPersonId],
      foreignColumns: [
        householdMemberships.householdId,
        householdMemberships.personId,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "transactions_household_received_by_person_fk",
      columns: [table.householdId, table.receivedByPersonId],
      foreignColumns: [
        householdMemberships.householdId,
        householdMemberships.personId,
      ],
    }).onDelete("cascade"),
    check("transactions_amount_positive", sql`${table.amountMinor} > 0`),
    check("transactions_version_positive", sql`${table.version} >= 1`),
    check("transactions_currency_format", currencyCheck(table.currency)),
    check(
      "transactions_transfer_distinct_accounts",
      sql`${table.fromAccountId} is null or ${table.toAccountId} is null or ${table.fromAccountId} <> ${table.toAccountId}`,
    ),
    check(
      "transactions_kind_structure",
      sql`(
        (${table.kind} = 'expense' and ${table.accountId} is not null and ${table.payee} is not null and length(btrim(${table.payee})) > 0 and ${table.paidByPersonId} is not null and ${table.source} is null and ${table.receivedByPersonId} is null and ${table.fromAccountId} is null and ${table.toAccountId} is null)
        or
        (${table.kind} = 'income' and ${table.accountId} is not null and ${table.source} is not null and length(btrim(${table.source})) > 0 and ${table.receivedByPersonId} is not null and ${table.payee} is null and ${table.paidByPersonId} is null and ${table.fromAccountId} is null and ${table.toAccountId} is null)
        or
        (${table.kind} = 'transfer' and ${table.fromAccountId} is not null and ${table.toAccountId} is not null and ${table.accountId} is null and ${table.payee} is null and ${table.paidByPersonId} is null and ${table.source} is null and ${table.receivedByPersonId} is null and ${table.categoryId} is null)
      )`,
    ),
    index("transactions_household_id_idx").on(table.householdId),
    index("transactions_account_id_idx").on(table.accountId),
    index("transactions_category_id_idx").on(table.categoryId),
    index("transactions_from_account_id_idx").on(table.fromAccountId),
    index("transactions_to_account_id_idx").on(table.toAccountId),
    index("transactions_occurred_on_idx").on(table.occurredOn),
    index("transactions_household_occurred_on_idx").on(
      table.householdId,
      table.occurredOn,
    ),
    index("transactions_household_voided_at_idx").on(
      table.householdId,
      table.voidedAt,
    ),
    uniqueIndex("transactions_household_submission_id_idx").on(
      table.householdId,
      table.submissionId,
    ),
  ],
);

export const transactionAuditEntries = financeSchema.table(
  "transaction_audit_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull(),
    householdId: uuid("household_id").notNull(),
    revision: integer("revision").notNull(),

    operation: transactionAuditOperationEnum("operation").notNull(),
    source: transactionAuditSourceEnum("source").default("manual").notNull(),
    authUserId: uuid("auth_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    recordedAt: instant("recorded_at").defaultNow().notNull(),
    beforeState: jsonb("before_state").$type<TransactionAuditSnapshot | null>(),
    afterState: jsonb("after_state").$type<TransactionAuditSnapshot>().notNull(),
    voidReason: varchar("void_reason", { length: 280 }),
  },
  (table) => [
    foreignKey({
      name: "transaction_audit_household_fk",
      columns: [table.householdId],
      foreignColumns: [households.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "transaction_audit_transaction_fk",
      columns: [table.transactionId],
      foreignColumns: [transactions.id],
    }).onDelete("restrict"),
    check("transaction_audit_revision_positive", sql`${table.revision} >= 1`),
    uniqueIndex("transaction_audit_tx_revision_unique").on(
      table.transactionId,
      table.revision,
    ),
    index("transaction_audit_tx_id_idx").on(table.transactionId),
    index("transaction_audit_household_id_idx").on(table.householdId),
    index("transaction_audit_recorded_at_idx").on(table.recordedAt),
    index("transaction_audit_household_recorded_at_idx").on(
      table.householdId,
      table.recordedAt,
    ),
  ],
);
