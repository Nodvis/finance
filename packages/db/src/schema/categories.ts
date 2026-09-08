import { sql } from "drizzle-orm";
import {
  check,
  index,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { CATEGORY_APPLICABILITIES } from "@nodvis/finance-domain";

import { households, instant } from "./foundation";
import { financeSchema } from "./namespace";

export const categoryApplicabilityEnum = financeSchema.enum(
  "category_applicability",
  CATEGORY_APPLICABILITIES,
);

export const categories = financeSchema.table(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    applicability: categoryApplicabilityEnum("applicability").notNull(),
    archivedAt: instant("archived_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("categories_household_id_id_unique").on(
      table.householdId,
      table.id,
    ),
    index("categories_household_id_idx").on(table.householdId),
    check(
      "categories_name_not_blank",
      sql`length(btrim(${table.name})) > 0`,
    ),
  ],
);
