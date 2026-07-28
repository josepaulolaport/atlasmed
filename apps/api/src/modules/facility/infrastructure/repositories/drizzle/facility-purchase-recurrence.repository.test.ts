import { describe, expect, it } from "bun:test";
import { DrizzleFacilityPurchaseRecurrenceRepository } from "./facility-purchase-recurrence.repository";

/**
 * Full integration coverage for per-profile funnel lives with Temporal backfill.
 * Unit tests here cover missing facility / missing profile early exits.
 */
describe("DrizzleFacilityPurchaseRecurrenceRepository", () => {
  it("returns null when facility is missing", async () => {
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      execute: async () => [],
      update: () => {
        throw new Error("must not update");
      },
    };
    const database = {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as never;
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(database);

    const saved = await repo.withLockedProfile(
      "missing",
      "vertical-1",
      async () => {
        throw new Error("callback must not run");
      },
    );
    expect(saved).toBeNull();
  });

  it("returns null when active profile is missing", async () => {
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "facility-1" }]),
          }),
        }),
      }),
      execute: async () => [],
      update: () => {
        throw new Error("must not update");
      },
    };
    const database = {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as never;
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(database);

    const saved = await repo.withLockedProfile(
      "facility-1",
      "vertical-missing",
      async () => {
        throw new Error("callback must not run");
      },
    );
    expect(saved).toBeNull();
  });
});
