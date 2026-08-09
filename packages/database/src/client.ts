import { drizzle } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as publicSchema from "./schema/public/index";
import * as auditSchema from "./schema/audit/index";

type Schema = typeof publicSchema & typeof auditSchema;

export type Database = ReturnType<typeof createDatabase>;

export type DatabaseTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

/** Accepts both a top-level database client and a transaction client. */
export type AnyDatabase = Database | DatabaseTransaction;

export function createDatabase(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, {
    schema: { ...publicSchema, ...auditSchema },
  });
}
