import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { resolve } from "path";
import { fileURLToPath } from "url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

const migrationsFolder = resolve(
  fileURLToPath(import.meta.url),
  "../../drizzle",
);

console.log("Applying migrations from", migrationsFolder);
await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis`);
await migrate(db, { migrationsFolder });
console.log("All migrations applied.");

await client.end();
