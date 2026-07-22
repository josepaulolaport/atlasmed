import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { facilities, orders } from "@atlasmed/database";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isIntegrationDatabaseReady } from "../../../../../test-utils/integration-database";
import { DrizzleFacilityPurchaseRecurrenceRepository } from "./facility-purchase-recurrence.repository";

const ids: string[] = [];
let dbReady = false;

describe("DrizzleFacilityPurchaseRecurrenceRepository SQL shape", () => {
  it("executes exactly one facility UPDATE after the locked callback succeeds", async () => {
    let updateCalls = 0;
    const returning = mock(async () => [{
      id: "facility-1",
      displayName: "Changed",
      neighborhood: null,
      city: null,
      state: null,
      taxIdType: null,
      cnpj: null,
      cpf: null,
      territoryId: null,
      territoryAssignmentStatus: "unassigned",
      territoryAssignmentSource: "geo",
      observedPurchaseIntervalDays: null,
      purchaseIntervalDays: 7,
      purchaseIntervalSource: "MANUAL",
      manualPurchaseProfile: "WEEKLY",
      lastValidPurchaseDate: null,
      purchaseRecurrenceSampleSize: 0,
      purchaseFunnelStage: "NEVER_PURCHASED",
      nextPurchaseFunnelTransitionDate: null,
      purchaseStatus: null,
      sourceProvider: null,
      externalSourceId: null,
      sourceContentHash: null,
      sourceFirstSeenAt: null,
      sourceLastSeenAt: null,
      sourcePresent: true,
      sourceTracked: false,
      manuallyEditedAt: new Date(),
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    const tx = {
      execute: async () => [{ manual_purchase_profile: null, manual_purchase_interval_days: null }],
      select: () => ({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        }),
      }),
      update: () => {
        updateCalls += 1;
        return { set: () => ({ where: () => ({ returning }) }) };
      },
    };
    const database = {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never;
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(database);

    await repo.withLockedFacility("facility-1", async () => ({
      configuration: { manualProfile: "WEEKLY", manualIntervalDays: null },
      snapshot: {
        observedPurchaseIntervalDays: null, purchaseIntervalDays: 7, purchaseIntervalSource: "MANUAL",
        manualPurchaseProfile: "WEEKLY", manualPurchaseIntervalDays: null, lastValidPurchaseDate: null,
        purchaseRecurrenceSampleSize: 0, purchaseFunnelStage: "NEVER_PURCHASED",
        nextPurchaseFunnelTransitionDate: null,
      },
      result: undefined,
    }), { name: "Changed", manuallyEditedAt: new Date() });

    expect(updateCalls).toBe(1);
  });

  it("executes no facility UPDATE when the locked callback throws", async () => {
    let updateCalls = 0;
    const tx = {
      execute: async () => [{ manual_purchase_profile: null, manual_purchase_interval_days: null }],
      select: () => ({
        from: () => ({
          where: () => ({
            groupBy: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }),
          }),
        }),
      }),
      update: () => { updateCalls += 1; throw new Error("must not update"); },
    };
    const database = {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never;
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(database);

    await expect(repo.withLockedFacility("facility-1", async () => {
      throw new Error("calculation failed");
    })).rejects.toThrow("calculation failed");
    expect(updateCalls).toBe(0);
  });
});

describe("DrizzleFacilityPurchaseRecurrenceRepository integration", () => {
  beforeAll(async () => { dbReady = await isIntegrationDatabaseReady(); });
  afterAll(async () => {
    if (!dbReady || ids.length === 0) return;
    await db.delete(orders).where(inArray(orders.facilityId, ids));
    await db.delete(facilities).where(inArray(facilities.id, ids));
  });

  it("loads only the latest 13 distinct valid UTC purchase dates", async () => {
    if (!dbReady) return;
    const facility = await db.insert(facilities).values({ displayName: "Recurrence repository test" }).returning().then(r => r[0]!);
    ids.push(facility.id);
    const validDates = Array.from({ length: 15 }, (_, index) => new Date(Date.UTC(2026, 0, index + 1, 23, 0)));
    const orderRows: Array<typeof orders.$inferInsert> = [
      ...validDates.map((orderedAt, index) => ({ facilityId: facility.id, orderedAt, status: index % 2 ? "APPROVED" as const : "INVOICED" as const, type: index % 2 ? "SALE" as const : "CONSIGNMENT" as const })),
      { facilityId: facility.id, orderedAt: new Date("2026-01-15T01:00:00Z"), status: "APPROVED", type: "SALE" },
      { facilityId: facility.id, orderedAt: new Date("2026-02-01T00:00:00Z"), status: "DRAFT", type: "SALE" },
      { facilityId: facility.id, orderedAt: new Date("2026-02-02T00:00:00Z"), status: "APPROVED", type: "DONATION" },
    ];
    await db.insert(orders).values(orderRows);

    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(db);
    const saved = await repo.withLockedFacility<string[]>(facility.id, async locked => ({
      configuration: locked.configuration,
      snapshot: {
        observedPurchaseIntervalDays: null, purchaseIntervalDays: 30, purchaseIntervalSource: "DEFAULT",
        manualPurchaseProfile: null, manualPurchaseIntervalDays: null, lastValidPurchaseDate: null,
        purchaseRecurrenceSampleSize: 0, purchaseFunnelStage: "NEVER_PURCHASED",
        nextPurchaseFunnelTransitionDate: null,
      },
      result: locked.purchaseDates,
    }));
    expect(saved?.result).toHaveLength(13);
    expect(saved?.result[0]).toBe("2026-01-15");
    expect(saved?.result.at(-1)).toBe("2026-01-03");
  });

  it("persists DEFAULT to CUSTOM configuration and snapshot in one constrained update", async () => {
    if (!dbReady) return;
    const facility = await db.insert(facilities).values({ displayName: "Recurrence atomic test" }).returning().then(r => r[0]!);
    ids.push(facility.id);
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(db);
    await repo.withLockedFacility(facility.id, async () => ({
      configuration: { manualProfile: "CUSTOM", manualIntervalDays: 45 },
      snapshot: {
        observedPurchaseIntervalDays: 20, purchaseIntervalDays: 45, purchaseIntervalSource: "MANUAL",
        manualPurchaseProfile: "CUSTOM", manualPurchaseIntervalDays: 45, lastValidPurchaseDate: "2026-01-01",
        purchaseRecurrenceSampleSize: 3, purchaseFunnelStage: "OUTSIDE_WINDOW",
        nextPurchaseFunnelTransitionDate: "2026-01-24",
      },
      result: undefined,
    }));
    const row = await db.select().from(facilities).where(eq(facilities.id, facility.id)).then(r => r[0]!);
    expect(row.manualPurchaseProfile).toBe("CUSTOM");
    expect(row.purchaseIntervalDays).toBe(45);
    expect(row.purchaseRecurrenceSampleSize).toBe(3);
    expect(row.purchaseRecurrenceCalculatedAt).toBeInstanceOf(Date);
  });

  it("atomically updates facility fields and recurrence in the same locked write", async () => {
    if (!dbReady) return;
    const facility = await db.insert(facilities).values({ displayName: "Combined update original" }).returning().then(r => r[0]!);
    ids.push(facility.id);
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(db);
    const saved = await repo.withLockedFacility(facility.id, async () => ({
      configuration: { manualProfile: "WEEKLY", manualIntervalDays: null },
      snapshot: {
        observedPurchaseIntervalDays: null, purchaseIntervalDays: 7, purchaseIntervalSource: "MANUAL",
        manualPurchaseProfile: "WEEKLY", manualPurchaseIntervalDays: null, lastValidPurchaseDate: null,
        purchaseRecurrenceSampleSize: 0, purchaseFunnelStage: "NEVER_PURCHASED",
        nextPurchaseFunnelTransitionDate: null,
      },
      result: undefined,
    }), { name: "Combined update changed", manuallyEditedAt: new Date("2026-01-10T12:00:00Z") });
    expect(saved?.facility.name).toBe("Combined update changed");
    expect(saved?.facility.purchaseIntervalSource).toBe("MANUAL");
    const row = await db.select().from(facilities).where(eq(facilities.id, facility.id)).then(r => r[0]!);
    expect(row.displayName).toBe("Combined update changed");
    expect(row.manualPurchaseProfile).toBe("WEEKLY");
  });

  it("persists MANUAL to AUTOMATIC without violating source constraints", async () => {
    if (!dbReady) return;
    const facility = await db.insert(facilities).values({
      displayName: "Recurrence automatic test",
      purchaseIntervalSource: "MANUAL",
      purchaseIntervalDays: 45,
      manualPurchaseProfile: "CUSTOM",
      manualPurchaseIntervalDays: 45,
    }).returning().then(r => r[0]!);
    ids.push(facility.id);
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(db);
    await repo.withLockedFacility(facility.id, async () => ({
      configuration: { manualProfile: null, manualIntervalDays: null },
      snapshot: {
        observedPurchaseIntervalDays: null, purchaseIntervalDays: 30, purchaseIntervalSource: "DEFAULT",
        manualPurchaseProfile: null, manualPurchaseIntervalDays: null, lastValidPurchaseDate: null,
        purchaseRecurrenceSampleSize: 0, purchaseFunnelStage: "NEVER_PURCHASED",
        nextPurchaseFunnelTransitionDate: null,
      },
      result: undefined,
    }));
    const row = await db.select().from(facilities).where(eq(facilities.id, facility.id)).then(r => r[0]!);
    expect(row.purchaseIntervalSource).toBe("DEFAULT");
    expect(row.manualPurchaseProfile).toBeNull();
    expect(row.manualPurchaseIntervalDays).toBeNull();
  });

  it("returns null for a missing facility instead of exposing a raw database error", async () => {
    if (!dbReady) return;
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(db);
    const saved = await repo.withLockedFacility("missing-facility", async () => {
      throw new Error("callback must not run");
    });
    expect(saved).toBeNull();
  });

  it("rolls back without persisting when the locked callback throws", async () => {
    if (!dbReady) return;
    const facility = await db.insert(facilities).values({ displayName: "Recurrence rollback test" }).returning().then(r => r[0]!);
    ids.push(facility.id);
    const repo = new DrizzleFacilityPurchaseRecurrenceRepository(db);
    await expect(repo.withLockedFacility(facility.id, async () => {
      throw new Error("calculation failed");
    })).rejects.toThrow("calculation failed");
    const row = await db.select().from(facilities).where(eq(facilities.id, facility.id)).then(r => r[0]!);
    expect(row.purchaseIntervalSource).toBe("DEFAULT");
    expect(row.manualPurchaseProfile).toBeNull();
    expect(row.purchaseRecurrenceCalculatedAt).toBeNull();
  });
});
