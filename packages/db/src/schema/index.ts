import { char, pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const financeSchema = pgSchema("finance");

export const households = financeSchema.table("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  defaultCurrency: char("default_currency", { length: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});
