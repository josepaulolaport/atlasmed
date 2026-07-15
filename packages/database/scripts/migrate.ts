import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { environment } from "@atlasmed/config";
import postgres from "postgres";
import { resolve } from "path";
import { fileURLToPath } from "url";

const client = postgres(environment.DATABASE_URL, { max: 1 });
const db = drizzle(client);

const migrationsFolder = resolve(
  fileURLToPath(import.meta.url),
  "../../drizzle",
);

console.log("Applying migrations from", migrationsFolder);
await migrate(db, { migrationsFolder });
console.log("All migrations applied.");

await client.end();
