import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { StatementImportMappingConfig } from "@nodvis/finance-domain";

import { accounts, households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const statementImportProfiles = financeSchema.table(
  "statement_import_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    mappingConfig: jsonb("mapping_config")
      .$type<StatementImportMappingConfig>()
      .notNull(),
    autoProcessSafe: boolean("auto_process_safe").default(false).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "statement_import_profiles_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    index("statement_import_profiles_household_id_idx").on(table.householdId),
    index("statement_import_profiles_account_id_idx").on(table.accountId),
    uniqueIndex("statement_import_profiles_household_account_name_idx").on(
      table.householdId,
      sql`coalesce(${table.accountId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.name,
    ),
  ],
);
