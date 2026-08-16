import { describe, expect, it } from "bun:test";
import type { PurchaseRecurrenceSnapshot } from "@atlasmed/facility-insights";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  FacilityPurchaseRecurrenceRepository,
  LockedFacilityPurchaseRecurrence,
  ManualPurchaseConfiguration,
} from "../interfaces/facility-purchase-recurrence.repository.interface";
import {
  PurchaseRecurrenceService,
  calculatePurchaseRecurrence,
  configurationFor,
} from "./purchase-recurrence.service";

const VERTICAL = 1;
const AUTOMATIC: ManualPurchaseConfiguration = {
  manualProfile: null,
  manualIntervalDays: null,
};

function repository(input?: {
  exists?: boolean;
  purchaseDates?: string[];
  configuration?: ManualPurchaseConfiguration;
}) {
  let configuration = input?.configuration ?? AUTOMATIC;
  let saved: PurchaseRecurrenceSnapshot | null = null;
  const repo: FacilityPurchaseRecurrenceRepository = {
    async withLockedProfile(_facilityId, verticalId, callback) {
      if (input?.exists === false) return null;
      const locked: LockedFacilityPurchaseRecurrence = {
        purchaseDates: input?.purchaseDates ?? [],
        configuration,
        verticalId,
      };
      const desired = await callback(locked);
      configuration = desired.configuration;
      saved = desired.snapshot;
      return { result: desired.result, facility: {} as never };
    },
  };
  return { repo, getConfiguration: () => configuration, getSaved: () => saved };
}

/**
 * `updateFacility` is the whole service now.
 *
 * `recalculateFacility`, `configurePurchaseRecurrence` and
 * `recalculateAllProfiles` had no caller outside these tests: the manual edit
 * arrives through `UpdateFacilityUseCase` — which does its own
 * `assertResourceInScope` — and every scheduled recalculation belongs to the
 * Temporal worker's own store. `recalculateAllProfiles` was a second, diverged
 * copy of that store's logic that no longer republished to Meilisearch, so
 * keeping it meant maintaining two answers to one question and shipping the
 * unused one.
 */
describe("PurchaseRecurrenceService", () => {
  it("keeps the default recurrence for a facility with zero purchases", async () => {
    const fake = repository({ purchaseDates: [] });
    await new PurchaseRecurrenceService(fake.repo).updateFacility(1, VERTICAL, {
      fields: {},
      configuration: AUTOMATIC,
      today: "2026-02-05",
    });
    expect(fake.getSaved()).toMatchObject({
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT",
      purchaseFunnelStage: "NEVER_PURCHASED",
      purchaseRecurrenceSampleSize: 0,
    });
  });

  it("keeps the default interval for a facility with one purchase", async () => {
    const fake = repository({ purchaseDates: ["2026-01-31"] });
    await new PurchaseRecurrenceService(fake.repo).updateFacility(1, VERTICAL, {
      fields: {},
      configuration: AUTOMATIC,
      today: "2026-02-05",
    });
    expect(fake.getSaved()).toMatchObject({
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT",
      lastValidPurchaseDate: "2026-01-31",
      purchaseRecurrenceSampleSize: 0,
    });
  });

  it("recalculates automatic recurrence from multiple purchase dates", async () => {
    const fake = repository({ purchaseDates: ["2026-01-31", "2026-01-01"] });
    await new PurchaseRecurrenceService(fake.repo).updateFacility(1, VERTICAL, {
      fields: {},
      configuration: AUTOMATIC,
      today: "2026-02-05",
    });
    expect(fake.getSaved()).toMatchObject({
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "CALCULATED",
      purchaseFunnelStage: "OUTSIDE_WINDOW",
    });
  });

  it("configures a preset and recalculates immediately", async () => {
    const fake = repository({ purchaseDates: ["2026-01-01"] });
    const service = new PurchaseRecurrenceService(fake.repo);
    await service.updateFacility(1, VERTICAL, {
      fields: {},
      configuration: service.prepareConfiguration({ mode: "PRESET", profile: "WEEKLY" }),
      today: "2026-01-10",
    });
    expect(fake.getConfiguration()).toEqual({ manualProfile: "WEEKLY", manualIntervalDays: null });
    expect(fake.getSaved()).toMatchObject({
      purchaseIntervalDays: 7,
      purchaseIntervalSource: "MANUAL",
      purchaseFunnelStage: "PURCHASE_WINDOW",
    });
  });

  it("configures a custom interval", async () => {
    const fake = repository({ purchaseDates: ["2026-01-01"] });
    const service = new PurchaseRecurrenceService(fake.repo);
    await service.updateFacility(1, VERTICAL, {
      fields: {},
      configuration: service.prepareConfiguration({ mode: "CUSTOM", intervalDays: 45 }),
      today: "2026-01-10",
    });
    expect(fake.getConfiguration()).toEqual({ manualProfile: "CUSTOM", manualIntervalDays: 45 });
    expect(fake.getSaved()).toMatchObject({
      manualPurchaseProfile: "CUSTOM",
      purchaseIntervalDays: 45,
    });
  });

  it("clears manual configuration in automatic mode", async () => {
    const fake = repository({
      purchaseDates: ["2026-01-31", "2026-01-01"],
      configuration: { manualProfile: "WEEKLY", manualIntervalDays: null },
    });
    const service = new PurchaseRecurrenceService(fake.repo);
    await service.updateFacility(1, VERTICAL, {
      fields: {},
      configuration: service.prepareConfiguration({ mode: "AUTOMATIC" }),
      today: "2026-02-05",
    });
    expect(fake.getConfiguration()).toEqual(AUTOMATIC);
    expect(fake.getSaved()).toMatchObject({
      purchaseIntervalSource: "CALCULATED",
      purchaseIntervalDays: 30,
    });
  });

  it("turns invalid custom intervals into structured ValidationError", () => {
    expect(() => configurationFor({ mode: "CUSTOM", intervalDays: 0 }))
      .toThrow(ValidationError);
    expect(() => configurationFor({ mode: "CUSTOM", intervalDays: 3651 }))
      .toThrow(ValidationError);
  });

  it("names the offending field when the calculator rejects a configuration", () => {
    try {
      calculatePurchaseRecurrence({
        purchaseDates: [],
        configuration: { manualProfile: "MONTHLY", manualIntervalDays: 31 },
        today: "2026-01-01",
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(JSON.stringify(error)).toContain("purchaseRecurrence.intervalDays");
    }
  });

  it("throws ResourceNotFoundError for a missing facility", async () => {
    const fake = repository({ exists: false });
    await expect(new PurchaseRecurrenceService(fake.repo).updateFacility(999, VERTICAL, {
      fields: {},
      configuration: AUTOMATIC,
      today: "2026-01-01",
    })).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
