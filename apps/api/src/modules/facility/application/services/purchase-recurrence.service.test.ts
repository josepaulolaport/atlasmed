import { describe, expect, it } from "bun:test";
import { ForbiddenError, type ScopeContext } from "@atlasmed/access";
import type { PurchaseRecurrenceSnapshot } from "@atlasmed/facility-insights";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  FacilityPurchaseRecurrenceRepository,
  LockedFacilityPurchaseRecurrence,
  ManualPurchaseConfiguration,
} from "../interfaces/facility-purchase-recurrence.repository.interface";
import { PurchaseRecurrenceService } from "./purchase-recurrence.service";

const globalScope: ScopeContext = {
  isGlobal: true,
  assignedTerritoryIds: [], effectiveTerritoryIds: [], analyticsEffectiveTerritoryIds: [],
  territoryIds: [], facilityIds: [], analyticsFacilityIds: [], clinicIds: [], analyticsClinicIds: [],
  managedUserIds: [], isOperationallyActive: true,
};

function repository(input?: {
  exists?: boolean;
  purchaseDates?: string[];
  configuration?: ManualPurchaseConfiguration;
}) {
  let configuration = input?.configuration ?? { manualProfile: null, manualIntervalDays: null };
  let saved: PurchaseRecurrenceSnapshot | null = null;
  const repo: FacilityPurchaseRecurrenceRepository = {
    async withLockedFacility(_facilityId, callback) {
      if (input?.exists === false) return null;
      const locked: LockedFacilityPurchaseRecurrence = {
        purchaseDates: input?.purchaseDates ?? [],
        configuration,
      };
      const desired = await callback(locked);
      configuration = desired.configuration;
      saved = desired.snapshot;
      return {
        result: desired.result,
        facility: {} as never,
      };
    },
  };
  return { repo, getConfiguration: () => configuration, getSaved: () => saved };
}

describe("PurchaseRecurrenceService", () => {
  it("keeps the default recurrence for a facility with zero purchases", async () => {
    const fake = repository({ purchaseDates: [] });
    const result = await new PurchaseRecurrenceService(fake.repo).recalculateFacility("facility-1", "2026-02-05");
    expect(result.purchaseIntervalDays).toBe(30);
    expect(result.purchaseIntervalSource).toBe("DEFAULT");
    expect(result.purchaseFunnelStage).toBe("NEVER_PURCHASED");
    expect(result.purchaseRecurrenceSampleSize).toBe(0);
    expect(fake.getSaved()).toEqual(result);
  });

  it("keeps the default interval for a facility with one purchase", async () => {
    const fake = repository({ purchaseDates: ["2026-01-31"] });
    const result = await new PurchaseRecurrenceService(fake.repo).recalculateFacility("facility-1", "2026-02-05");
    expect(result.purchaseIntervalDays).toBe(30);
    expect(result.purchaseIntervalSource).toBe("DEFAULT");
    expect(result.lastValidPurchaseDate).toBe("2026-01-31");
    expect(result.purchaseRecurrenceSampleSize).toBe(0);
    expect(fake.getSaved()).toEqual(result);
  });

  it("recalculates automatic recurrence from multiple purchase dates", async () => {
    const fake = repository({ purchaseDates: ["2026-01-31", "2026-01-01"] });
    const result = await new PurchaseRecurrenceService(fake.repo).recalculateFacility("facility-1", "2026-02-05");
    expect(result.purchaseIntervalDays).toBe(30);
    expect(result.purchaseIntervalSource).toBe("CALCULATED");
    expect(result.purchaseFunnelStage).toBe("OUTSIDE_WINDOW");
    expect(fake.getSaved()).toEqual(result);
  });

  it("configures a preset and recalculates immediately", async () => {
    const fake = repository({ purchaseDates: ["2026-01-01"] });
    const result = await new PurchaseRecurrenceService(fake.repo).configurePurchaseRecurrence(
      "facility-1", { mode: "PRESET", profile: "WEEKLY" }, globalScope, "2026-01-10",
    );
    expect(fake.getConfiguration()).toEqual({ manualProfile: "WEEKLY", manualIntervalDays: null });
    expect(result.purchaseIntervalDays).toBe(7);
    expect(result.purchaseIntervalSource).toBe("MANUAL");
    expect(result.purchaseFunnelStage).toBe("PURCHASE_WINDOW");
  });

  it("configures a custom interval", async () => {
    const fake = repository({ purchaseDates: ["2026-01-01"] });
    const result = await new PurchaseRecurrenceService(fake.repo).configurePurchaseRecurrence(
      "facility-1", { mode: "CUSTOM", intervalDays: 45 }, globalScope, "2026-01-10",
    );
    expect(fake.getConfiguration()).toEqual({ manualProfile: "CUSTOM", manualIntervalDays: 45 });
    expect(result.manualPurchaseProfile).toBe("CUSTOM");
    expect(result.purchaseIntervalDays).toBe(45);
  });

  it("clears manual configuration in automatic mode", async () => {
    const fake = repository({
      purchaseDates: ["2026-01-31", "2026-01-01"],
      configuration: { manualProfile: "WEEKLY", manualIntervalDays: null },
    });
    const result = await new PurchaseRecurrenceService(fake.repo).configurePurchaseRecurrence(
      "facility-1", { mode: "AUTOMATIC" }, globalScope, "2026-02-05",
    );
    expect(fake.getConfiguration()).toEqual({ manualProfile: null, manualIntervalDays: null });
    expect(result.purchaseIntervalSource).toBe("CALCULATED");
    expect(result.purchaseIntervalDays).toBe(30);
  });

  it("turns invalid custom intervals into structured ValidationError", async () => {
    const fake = repository();
    await expect(new PurchaseRecurrenceService(fake.repo).configurePurchaseRecurrence(
      "facility-1", { mode: "CUSTOM", intervalDays: 0 }, globalScope, "2026-01-01",
    )).rejects.toBeInstanceOf(ValidationError);
  });

  it("checks facility scope before opening a transaction", async () => {
    let opened = false;
    const fake = repository();
    const scopedRepo: FacilityPurchaseRecurrenceRepository = {
      async withLockedFacility(id, callback) { opened = true; return fake.repo.withLockedFacility(id, callback); },
    };
    const scope = { ...globalScope, isGlobal: false, facilityIds: [] } as ScopeContext;
    await expect(new PurchaseRecurrenceService(scopedRepo).configurePurchaseRecurrence(
      "facility-1", { mode: "AUTOMATIC" }, scope, "2026-01-01",
    )).rejects.toBeInstanceOf(ForbiddenError);
    expect(opened).toBe(false);
  });

  it("throws ResourceNotFoundError for a missing facility", async () => {
    const fake = repository({ exists: false });
    await expect(new PurchaseRecurrenceService(fake.repo).recalculateFacility(
      "missing", "2026-01-01",
    )).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
