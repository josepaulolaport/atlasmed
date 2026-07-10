import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as publicSchema from "./schema/public/index";
import * as registrySchema from "./schema/registry/index";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, {
    schema: { ...publicSchema, ...registrySchema },
  });
}
