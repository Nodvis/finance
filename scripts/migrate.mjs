import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString, connectionTimeoutMillis: 3_000 });
try {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await pool.query("select 1");
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  if (lastError) throw lastError;
  console.log("PostgreSQL is ready; applying Nodvis Finance migrations.");
  await migrate(drizzle(pool), { migrationsFolder: "/app/drizzle" });
  console.log("Nodvis Finance migrations completed.");
} finally {
  await pool.end();
}
