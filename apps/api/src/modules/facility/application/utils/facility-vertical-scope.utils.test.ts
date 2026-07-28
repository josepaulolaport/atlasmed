import { describe, expect, it } from "bun:test";
import { applyVerticalProfileContext } from "./facility-vertical-scope.utils";

const ortho = {
  verticalId: "v-orto",
  verticalCode: "ORTOPEDIA",
  verticalName: "Ortopedia",
  isActive: true,
  commercialStatus: "UNREGISTERED" as const,
  purchaseStatus: null,
  territoryId: null,
};

const derm = {
  verticalId: "v-derm",
  verticalCode: "DERMATOLOGIA",
  verticalName: "Dermatologia",
  isActive: true,
  commercialStatus: "UNREGISTERED" as const,
  purchaseStatus: null,
  territoryId: null,
};

describe("applyVerticalProfileContext", () => {
  it("exposes shared commercialStatus when multi-vertical profiles agree", () => {
    const result = applyVerticalProfileContext(
      {
        commercialStatus: null,
        purchaseStatus: null,
        verticalProfiles: [ortho, derm],
      },
      [ortho.verticalId, derm.verticalId],
    );

    expect(result.commercialStatus).toBe("UNREGISTERED");
    expect(result.verticalProfiles).toHaveLength(2);
    expect(result.hasProfileContext).toBe(true);
  });

  it("omits commercialStatus when multi-vertical profiles disagree", () => {
    const result = applyVerticalProfileContext(
      {
        commercialStatus: null,
        purchaseStatus: null,
        verticalProfiles: [
          ortho,
          { ...derm, commercialStatus: "REGISTERED" },
        ],
      },
      [ortho.verticalId, derm.verticalId],
    );

    expect(result.commercialStatus).toBeUndefined();
    expect(result.verticalProfiles).toHaveLength(2);
  });

  it("omits top-level purchaseRecurrence when funnel stages disagree", () => {
    const recurrence = {
      observedPurchaseIntervalDays: null,
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT" as const,
      manualPurchaseProfile: null,
      manualPurchaseIntervalDays: null,
      lastValidPurchaseDate: null,
      purchaseRecurrenceSampleSize: 0,
      nextPurchaseFunnelTransitionDate: null,
    };
    const result = applyVerticalProfileContext(
      {
        commercialStatus: null,
        purchaseStatus: null,
        verticalProfiles: [
          {
            ...ortho,
            purchaseRecurrence: {
              ...recurrence,
              purchaseFunnelStage: "PURCHASE_WINDOW",
            },
          },
          {
            ...derm,
            purchaseRecurrence: {
              ...recurrence,
              purchaseFunnelStage: "NEVER_PURCHASED",
            },
          },
        ],
      },
      [ortho.verticalId, derm.verticalId],
    );

    expect(result.purchaseRecurrence).toBeUndefined();
    expect(result.verticalProfiles?.[0]?.purchaseRecurrence?.purchaseFunnelStage)
      .toBe("PURCHASE_WINDOW");
  });

  it("scopes commercial/funnel to one Linha but can expose all assigned profiles", () => {
    const result = applyVerticalProfileContext(
      {
        commercialStatus: null,
        purchaseStatus: null,
        verticalProfiles: [
          {
            ...ortho,
            commercialStatus: "REGISTERED",
            purchaseRecurrence: {
              observedPurchaseIntervalDays: null,
              purchaseIntervalDays: 30,
              purchaseIntervalSource: "DEFAULT",
              manualPurchaseProfile: null,
              manualPurchaseIntervalDays: null,
              lastValidPurchaseDate: null,
              purchaseRecurrenceSampleSize: 0,
              purchaseFunnelStage: "PURCHASE_WINDOW",
              nextPurchaseFunnelTransitionDate: null,
            },
          },
          derm,
        ],
      },
      [ortho.verticalId],
      { exposeProfileVerticalIds: [ortho.verticalId, derm.verticalId] },
    );

    expect(result.commercialStatus).toBe("REGISTERED");
    expect(result.purchaseRecurrence?.purchaseFunnelStage).toBe("PURCHASE_WINDOW");
    expect(result.verticalProfiles).toHaveLength(2);
  });
});
