import { sql } from "drizzle-orm";
import { check, integer, timestamp, uuid } from "drizzle-orm/pg-core";

import { authUsers } from "./auth";
import { financeSchema } from "./namespace";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/** One persisted row makes first-run state explicit and lockable. */
export const instanceState = financeSchema.table(
  "instance_state",
  {
    id: integer("id").primaryKey().default(1),
    initializedAt: instant("initialized_at"),
    ownerAuthUserId: uuid("owner_auth_user_id").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [check("instance_state_singleton", sql`${table.id} = 1`)],
);