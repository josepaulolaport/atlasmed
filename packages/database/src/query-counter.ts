import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Counts the database queries one operation issues.
 *
 * Latency here is dominated by round-trip *count*, not by query time: measured
 * 2026-08-13, the API sat ~60ms from the database while the queries themselves
 * executed in ~0.12ms. Optimising SQL that already runs in a fraction of a
 * millisecond is not the lever; issuing fewer round trips is.
 *
 * Counting rather than timing is deliberate. A wall-clock assertion is noisy,
 * machine-dependent, and fails on a slow CI box for reasons that have nothing
 * to do with the code. A query count is exact, reproducible, and is the number
 * the latency is actually a function of.
 *
 * Inert unless something opened a scope with [withQueryCount], so leaving the
 * logger attached in production costs one AsyncLocalStorage lookup per query.
 */
export interface QueryRecord {
  sql: string;
  /** Order in which the query was issued, from 1. */
  index: number;
}

export interface QueryScope {
  queries: QueryRecord[];
}

const storage = new AsyncLocalStorage<QueryScope>();

/** Drizzle logger that records into the active scope, if any. */
export const queryCountLogger = {
  logQuery(query: string): void {
    const scope = storage.getStore();
    if (!scope) return;
    scope.queries.push({ sql: query, index: scope.queries.length + 1 });
  },
};

/**
 * Runs [operation] with query recording enabled and returns what it issued
 * alongside its result.
 *
 * Scopes nest safely: an inner call gets its own store, so a test can measure a
 * sub-step without its queries also landing in an outer count.
 */
export async function withQueryCount<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; queries: QueryRecord[] }> {
  const scope: QueryScope = { queries: [] };
  const result = await storage.run(scope, operation);
  return { result, queries: scope.queries };
}

/** Convenience for assertions that only care about how many. */
export async function countQueries(
  operation: () => Promise<unknown>,
): Promise<number> {
  const { queries } = await withQueryCount(operation);
  return queries.length;
}

/**
 * Groups recorded queries by their shape, commonest first.
 *
 * What makes an N+1 obvious: twenty round trips are unremarkable until you see
 * that eighteen of them are the same statement with a different id.
 */
export function summarizeQueries(
  queries: QueryRecord[],
): Array<{ sql: string; count: number }> {
  const byShape = new Map<string, number>();
  for (const query of queries) {
    const shape = query.sql.replace(/\s+/g, " ").trim();
    byShape.set(shape, (byShape.get(shape) ?? 0) + 1);
  }
  return [...byShape.entries()]
    .map(([sql, count]) => ({ sql, count }))
    .sort((left, right) => right.count - left.count);
}
