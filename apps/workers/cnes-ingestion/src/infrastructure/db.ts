import { createDatabase, type Database } from "@atlasmed/database";

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  dbInstance = createDatabase(connectionString);
  return dbInstance;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const client = getDb();
    const value = (client as any)[property as string];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
