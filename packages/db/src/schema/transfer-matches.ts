import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth";
import { households, instant } from "./foundation";
import { financeSchema } from "./namespace";
import { transactions } from "./transactions";

export const transferMatches = financeSchema.table(
  "transfer_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull(),
    transferTransactionId: uuid("transfer_transaction_id").notNull(),
    matchedTransactionId: uuid("matched_transaction_id").notNull(),
    matchedIdentifier: varchar("matched_identifier", { length: 64 }),
    matchConfidence: varchar("match_confidence", { length: 32 })
      .default("automatic")
      .notNull(),
    notes: varchar("notes", { length: 280 }),
    matchedByAuthUserId: uuid("matched_by_auth_user_id").references(
      () => authUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "transfer_matches_household_fk",
      columns: [table.householdId],
      foreignColumns: [households.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "transfer_matches_transfer_tx_fk",
      columns: [table.transferTransactionId],
      foreignColumns: [transactions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "transfer_matches_matched_tx_fk",
      columns: [table.matchedTransactionId],
      foreignColumns: [transactions.id],
    }).onDelete("cascade"),
    uniqueIndex("transfer_matches_transfer_matched_idx").on(
      table.transferTransactionId,
      table.matchedTransactionId,
    ),
    index("transfer_matches_household_id_idx").on(table.householdId),
    index("transfer_matches_transfer_tx_idx").on(table.transferTransactionId),
    index("transfer_matches_matched_tx_idx").on(table.matchedTransactionId),
  ],
);
