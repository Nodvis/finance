import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { ACCOUNT_TYPES } from "@nodvis/finance-domain";

import { authUsers } from "./auth";
import { financeSchema } from "./namespace";

export const accountTypeEnum = financeSchema.enum("account_type", ACCOUNT_TYPES);

export const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const currencyCheck = (column: { getSQLType(): string }) =>
  sql`${column} ~ '^[A-Z]{3}$'`;

export const households = financeSchema.table(
  "households",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    defaultCurrency: varchar("default_currency", { length: 3 }).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("households_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "households_default_currency_format",
      currencyCheck(table.defaultCurrency),
    ),
  ],
);

export const persons = financeSchema.table(
  "persons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "persons_display_name_not_blank",
      sql`length(btrim(${table.displayName})) > 0`,
    ),
  ],
);

export const householdMemberships = financeSchema.table(
  "household_memberships",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "household_memberships_pk",
      columns: [table.householdId, table.personId],
    }),
    index("household_memberships_person_id_idx").on(table.personId),
  ],
);

export const personAuthLinks = financeSchema.table(
  "person_auth_links",
  {
    authUserId: uuid("auth_user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [unique("person_auth_links_person_id_unique").on(table.personId)],
);

export const accounts = financeSchema.table(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    type: accountTypeEnum("type").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    balanceSnapshotMinor: bigint("balance_snapshot_minor", {
      mode: "bigint",
    }),
    balanceSnapshotAt: instant("balance_snapshot_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("accounts_household_id_id_unique").on(table.householdId, table.id),
    index("accounts_household_id_idx").on(table.householdId),
    check("accounts_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("accounts_currency_format", currencyCheck(table.currency)),
    check(
      "accounts_balance_snapshot_complete",
      sql`(${table.balanceSnapshotMinor} is null) = (${table.balanceSnapshotAt} is null)`,
    ),
  ],
);

export const accountOwners = financeSchema.table(
  "account_owners",
  {
    householdId: uuid("household_id").notNull(),
    accountId: uuid("account_id").notNull(),
    personId: uuid("person_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "account_owners_pk",
      columns: [table.accountId, table.personId],
    }),
    foreignKey({
      name: "account_owners_household_account_fk",
      columns: [table.householdId, table.accountId],
      foreignColumns: [accounts.householdId, accounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "account_owners_household_person_fk",
      columns: [table.householdId, table.personId],
      foreignColumns: [
        householdMemberships.householdId,
        householdMemberships.personId,
      ],
    }).onDelete("cascade"),
    index("account_owners_person_id_idx").on(table.personId),
  ],
);
