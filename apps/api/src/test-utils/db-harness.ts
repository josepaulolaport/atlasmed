import { db } from "../infrastructure/database/db";
import { createDbHarness, uniqueAbbreviation } from "@atlasmed/test-support";

/**
 * `apps/api`'s binding of the shared harness — see `@atlasmed/test-support` for
 * the rules and the reasoning. This file exists so tests keep importing from
 * one place per app and never have to reach for the app's `db` themselves.
 */
const harness = createDbHarness(db);

export const isDatabaseReachable = harness.isDatabaseReachable;
export const withRollback = harness.withRollback;
export const assertMigrated = harness.assertMigrated;
export { uniqueAbbreviation };
export type { Tx } from "@atlasmed/test-support";
