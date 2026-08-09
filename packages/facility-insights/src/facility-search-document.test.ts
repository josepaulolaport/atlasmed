import { describe, expect, it } from "bun:test";
import {
  deriveFacilityProfileFunnelFields,
  mapFacilitySearchDocument,
} from "./facility-search-document";

describe("mapFacilitySearchDocument", () => {
  it("maps searchable fields, sorts repUserIds, and derives funnel attrs", () => {
    expect(
      mapFacilitySearchDocument({
        id: 1,
        displayName: "Clínica Central",
        legalName: "Clínica Central Ltda",
        tradeName: "Central",
        legalDocument: "123",
        cnesCode: "789",
        city: "São Paulo",
        state: "SP",
        streetAddress: "Rua Augusta",
        neighborhood: "Consolação",
        verticalIds: [10],
        territoryIds: [20],
        repUserIds: [7, 3, 3],
        profileFunnelData: [
          {
            verticalId: 10,
            purchaseFunnelStage: "NEVER_PURCHASED",
            purchaseIntervalDays: 30,
            purchaseIntervalSource: "DEFAULT",
            manualPurchaseProfile: null,
            lastValidPurchaseDate: null,
          },
        ],
        latitude: -23.55,
        longitude: -46.63,
        deactivatedAt: null,
      }),
    ).toMatchObject({
      id: "1",
      name: "Clínica Central",
      repUserIds: [3, 7],
      territoryIds: [20],
      territoryAssignmentStatus: "assigned",
      streetAddress: "Rua Augusta",
      neighborhood: "Consolação",
      _geo: { lat: -23.55, lng: -46.63 },
    });
  });

  it("returns null for deactivated facilities", () => {
    expect(
      mapFacilitySearchDocument({
        id: 1,
        displayName: "X",
        legalName: null,
        tradeName: null,
        legalDocument: null,
        cnesCode: null,
        city: null,
        state: null,
        latitude: null,
        longitude: null,
        deactivatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toBeNull();
  });
});

describe("deriveFacilityProfileFunnelFields", () => {
  it("builds composite funnel tokens and interval min", () => {
    expect(
      deriveFacilityProfileFunnelFields([
        {
          verticalId: 2,
          purchaseFunnelStage: "PURCHASE_WINDOW",
          purchaseIntervalDays: 45,
          purchaseIntervalSource: "MANUAL",
          manualPurchaseProfile: "MONTHLY",
          lastValidPurchaseDate: "2026-01-15",
        },
      ]),
    ).toMatchObject({
      verticalFunnelStages: ["2:PURCHASE_WINDOW"],
      verticalPurchaseIntervalSources: ["2:MANUAL"],
      verticalManualPurchaseProfiles: ["2:MONTHLY"],
      purchaseFunnelStagesAny: ["PURCHASE_WINDOW"],
      purchaseIntervalDaysMin: 45,
      hasLastValidPurchase: 1,
    });
  });
});
