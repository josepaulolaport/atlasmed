import { createDatabase, type Database } from "@atlasmed/database";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const db: Database = createDatabase(connectionString);
