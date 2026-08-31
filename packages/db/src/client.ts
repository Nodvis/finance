import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema/index";

let pool: Pool | undefined;
let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase(connectionString: string) {
  pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export function getDb() {
  if (database) {
    return database;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before database access");
  }

  database = createDatabase(connectionString);
  return database;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
  }

  pool = undefined;
  database = undefined;
}
