import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { ACCOUNT_IDENTIFIER_TYPES } from "@nodvis/finance-domain";

import { accounts, households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const accountIdentifierTypeEnum = financeSchema.enum(
  "account_identifier_type",
  ACCOUNT_IDENTIFIER_TYPES,
);

export const accountIdentifiers = financeSchema.table(
  "account_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull(),
    accountId: uuid("account_id").notNull(),
    identifierType: accountIdentifierTypeEnum("identifier_type")
      .default("iban")
      .notNull(),
    rawIdentifier: varchar("raw_identifier", { length: 128 }).notNull(),
    normalizedIdentifier: varchar("normalized_identifier", { length: 64 }).notNull(),
    label: varchar("label", { length: 160 }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "account_identifiers_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "account_identifiers_household_fk",
      columns: [table.householdId],
      foreignColumns: [households.id],
    }).onDelete("cascade"),
    index("account_identifiers_household_id_idx").on(table.householdId),
    index("account_identifiers_account_id_idx").on(table.accountId),
    uniqueIndex("account_identifiers_household_normalized_idx").on(
      table.householdId,
      table.normalizedIdentifier,
    ),
  ],
);
