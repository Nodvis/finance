import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString, connectionTimeoutMillis: 3_000 });
try {
  console.log("[nodvis-finance] PostgreSQL connection check started.");
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await pool.query("select 1");
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      const code = error?.code;
      if (code === "28P01" || code === "28000" || code === "3D000") {
        console.error(
          `[nodvis-finance] PostgreSQL rejected the configured connection (code ${code}). Changing POSTGRES_PASSWORD does not change the password stored in an existing PostgreSQL volume. Restore the original password or follow the documented credential-rotation procedure.`,
        );
        throw error;
      }
      console.log(
        `[nodvis-finance] PostgreSQL is not ready yet${code ? ` (code ${code})` : ""}; retrying.`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  if (lastError) {
    console.error(
      "[nodvis-finance] PostgreSQL did not become reachable within 120 seconds; stopping without starting the web server.",
    );
    throw lastError;
  }
  console.log("[nodvis-finance] PostgreSQL is reachable; applying migrations.");
  await migrate(drizzle(pool), { migrationsFolder: "/app/drizzle" });
  console.log("[nodvis-finance] Migrations completed.");
} finally {
  await pool.end();
}
