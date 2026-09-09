import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { households, instant } from "./foundation";
import { transactions } from "./transactions";
import { financeSchema } from "./namespace";

export const ruleMatchFieldEnum = financeSchema.enum("categorization_rule_match_field", ["counterparty"]);
export const ruleMatchModeEnum = financeSchema.enum("categorization_rule_match_mode", ["contains", "exact", "starts_with"]);
export const ruleApplicationStatusEnum = financeSchema.enum("categorization_rule_application_status", ["applied", "skipped_conflict", "skipped_stale"]);

export const categorizationRules = financeSchema.table(
  "categorization_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    matchField: ruleMatchFieldEnum("match_field").notNull(),
    matchMode: ruleMatchModeEnum("match_mode").notNull(),
    matchText: varchar("match_text", { length: 160 }).notNull(),
    applicability: varchar("applicability", { length: 16 }).notNull(),
    categoryId: uuid("category_id").notNull(),
    priority: integer("priority").notNull().default(100),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "categorization_rules_household_category_fk",
      columns: [table.householdId, table.categoryId],
      foreignColumns: [categories.householdId, categories.id],
    }).onDelete("restrict"),
    index("categorization_rules_household_idx").on(table.householdId),
    index("categorization_rules_lookup_idx").on(table.householdId, table.enabled, table.priority),
    check("categorization_rules_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("categorization_rules_match_text_not_blank", sql`length(btrim(${table.matchText})) > 0`),
    check("categorization_rules_priority_nonnegative", sql`${table.priority} >= 0`),
    check("categorization_rules_applicability_valid", sql`${table.applicability} in ('expense', 'income', 'both')`),
  ],
);

export const categorizationRuleApplications = financeSchema.table(
  "categorization_rule_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").notNull().references(() => categorizationRules.id, { onDelete: "restrict" }),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
    beforeCategoryId: uuid("before_category_id"),
    afterCategoryId: uuid("after_category_id"),
    status: ruleApplicationStatusEnum("status").notNull(),
    explanation: varchar("explanation", { length: 280 }).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("categorization_rule_applications_household_idx").on(table.householdId, table.createdAt),
    index("categorization_rule_applications_transaction_idx").on(table.transactionId),
  ],
);
