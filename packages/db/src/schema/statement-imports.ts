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
  STATEMENT_IMPORT_BATCH_STATUSES,
  STATEMENT_IMPORT_ROW_KINDS,
  STATEMENT_IMPORT_ROW_STATUSES,
  type StatementImportMappingConfig,
} from "@nodvis/finance-domain";

import { authUsers } from "./auth";
import { accounts, currencyCheck, households, instant } from "./foundation";
import { financeSchema } from "./namespace";
import { transactions } from "./transactions";

export const statementImportBatchStatusEnum = financeSchema.enum(
  "statement_import_batch_status",
  STATEMENT_IMPORT_BATCH_STATUSES,
);

export const statementImportRowStatusEnum = financeSchema.enum(
  "statement_import_row_status",
  STATEMENT_IMPORT_ROW_STATUSES,
);

export const statementImportRowKindEnum = financeSchema.enum(
  "statement_import_row_kind",
  STATEMENT_IMPORT_ROW_KINDS,
);

export const statementImportBatches = financeSchema.table(
  "statement_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sourceFilename: varchar("source_filename", { length: 255 }).notNull(),
    fileHash: varchar("file_hash", { length: 64 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    parserVersion: varchar("parser_version", { length: 32 })
      .default("1.0.0")
      .notNull(),
    sourceNamespace: varchar("source_namespace", { length: 64 })
      .default("generic_csv")
      .notNull(),
    sourceAccountId: varchar("source_account_id", { length: 128 }),
    mappingConfig: jsonb("mapping_config")
      .$type<StatementImportMappingConfig>()
      .notNull(),
    status: statementImportBatchStatusEnum("status")
      .default("preview")
      .notNull(),
    totalRowCount: integer("total_row_count").default(0).notNull(),
    validRowCount: integer("valid_row_count").default(0).notNull(),
    invalidRowCount: integer("invalid_row_count").default(0).notNull(),
    importedRowCount: integer("imported_row_count").default(0).notNull(),
    skippedRowCount: integer("skipped_row_count").default(0).notNull(),
    createdByAuthUserId: uuid("created_by_auth_user_id").references(
      () => authUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: instant("created_at").defaultNow().notNull(),
    committedAt: instant("committed_at"),
  },
  (table) => [
    foreignKey({
      name: "statement_import_batches_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    index("statement_import_batches_household_id_idx").on(table.householdId),
    index("statement_import_batches_account_id_idx").on(table.accountId),
    index("statement_import_batches_household_created_at_idx").on(
      table.householdId,
      table.createdAt,
    ),
    index("statement_import_batches_account_file_hash_idx").on(
      table.accountId,
      table.fileHash,
    ),
  ],
);

export const statementImportRows = financeSchema.table(
  "statement_import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => statementImportBatches.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    sourceNamespace: varchar("source_namespace", { length: 64 })
      .default("generic_csv")
      .notNull(),
    sourceAccountId: varchar("source_account_id", { length: 128 }),
    authoritativeId: varchar("authoritative_id", { length: 255 }),
    fallbackIdentifier: varchar("fallback_identifier", { length: 255 }),
    fallbackEvidence: jsonb("fallback_evidence").$type<Record<string, unknown>>(),
    occurrenceIndex: integer("occurrence_index").default(0).notNull(),
    identityType: varchar("identity_type", { length: 32 })
      .default("fallback")
      .notNull(),
    ambiguityState: varchar("ambiguity_state", { length: 32 })
      .default("unambiguous")
      .notNull(),
    sourceRowIdentity: varchar("source_row_identity", { length: 255 }),
    dedupeHash: varchar("dedupe_hash", { length: 64 }).notNull(),
    status: statementImportRowStatusEnum("status").default("pending").notNull(),
    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: varchar("error_message", { length: 500 }),
    rawRowContent: varchar("raw_row_content", { length: 2000 }),
    rawValues: jsonb("raw_values").$type<Record<string, string>>(),
    normalizedOccurredOn: instant("normalized_occurred_on"),
    normalizedKind: statementImportRowKindEnum("normalized_kind"),
    normalizedAmountMinor: bigint("normalized_amount_minor", {
      mode: "bigint",
    }),
    normalizedCurrency: varchar("normalized_currency", { length: 3 }),
    normalizedPayee: varchar("normalized_payee", { length: 160 }),
    normalizedSource: varchar("normalized_source", { length: 160 }),
    normalizedDescription: varchar("normalized_description", { length: 280 }),
    committedTransactionId: uuid("committed_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" },
    ),
    canonicalTransactionId: uuid("canonical_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" },
    ),
    matchedImportRowId: uuid("matched_import_row_id"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "statement_import_rows_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "statement_import_rows_matched_row_fk",
      columns: [table.matchedImportRowId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    check(
      "statement_import_rows_currency_format",
      sql`${table.normalizedCurrency} is null or ${currencyCheck(table.normalizedCurrency)}`,
    ),
    uniqueIndex("statement_import_rows_batch_row_idx").on(
      table.batchId,
      table.rowIndex,
    ),
    uniqueIndex("statement_import_rows_account_dedupe_idx")
      .on(table.accountId, table.dedupeHash)
      .where(sql`${table.status} = 'imported'`),
    uniqueIndex("statement_import_rows_account_auth_imported_idx")
      .on(
        table.householdId,
        table.accountId,
        table.sourceNamespace,
        sql`coalesce(${table.sourceAccountId}, ${table.accountId}::text)`,
        table.authoritativeId,
      )
      .where(
        sql`${table.status} = 'imported' and ${table.authoritativeId} is not null`,
      ),
    index("statement_import_rows_batch_id_idx").on(table.batchId),
    index("statement_import_rows_household_id_idx").on(table.householdId),
    index("statement_import_rows_account_id_idx").on(table.accountId),
    index("statement_import_rows_committed_tx_id_idx").on(
      table.committedTransactionId,
    ),
    index("statement_import_rows_canonical_tx_id_idx").on(
      table.canonicalTransactionId,
    ),
    index("statement_import_rows_matched_row_id_idx").on(
      table.matchedImportRowId,
    ),
    index("statement_import_rows_fallback_idx").on(
      table.householdId,
      table.accountId,
      table.fallbackIdentifier,
    ),
  ],
);
