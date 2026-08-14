import { db } from "../infrastructure/db";
import { createDbHarness, uniqueAbbreviation } from "@atlasmed/test-support";

/**
 * The Temporal worker's binding of the shared harness — see
 * `@atlasmed/test-support` for the rules and the reasoning. The worker owns the
 * two pieces of code most able to fail only against real Postgres: the Emultec
 * importer and the purchase-recurrence store.
 */
const harness = createDbHarness(db);

export const isDatabaseReachable = harness.isDatabaseReachable;
export const withRollback = harness.withRollback;
export const assertMigrated = harness.assertMigrated;
export { uniqueAbbreviation };
export type { Tx } from "@atlasmed/test-support";
