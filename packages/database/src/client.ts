import { drizzle } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as publicSchema from "./schema/public/index";
import * as auditSchema from "./schema/audit/index";
import { queryCountLogger } from "./query-counter";

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
    // Records only while a `withQueryCount` scope is open, which nothing but a
    // test does — otherwise it is one AsyncLocalStorage lookup per query and no
    // output. Attached here rather than in each app so a count measures the
    // real client, not a test-only one assembled differently.
    logger: queryCountLogger,
  });
}
