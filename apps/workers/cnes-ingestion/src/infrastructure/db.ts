import { environment } from "@atlasmed/config";
import { createDatabase, type Database } from "@atlasmed/database";

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = createDatabase(environment.DATABASE_URL);
  return dbInstance;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const client = getDb();
    const value = (client as any)[property as string];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
