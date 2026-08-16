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
        unitTypeId: 3,
        legalDocumentType: "CNPJ",
        clinicalFocusIds: [9, 4, 4],
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
      unitTypeId: 3,
      legalDocumentType: "CNPJ",
      // De-duplicated and sorted, like repUserIds: the filter is an AND over
      // membership, so a repeat would only bloat the document.
      clinicalFocusIds: [4, 9],
      _geo: { lat: -23.55, lng: -46.63 },
    });
  });

  it("emits both filter fields as null when the facility has neither", () => {
    // They must be present-and-null rather than absent: Meili cannot filter a
    // field some documents omit, and CNES data has gaps in both columns.
    const document = mapFacilitySearchDocument({
      id: 2,
      displayName: "Sem cadastro completo",
      legalName: null,
      tradeName: null,
      legalDocument: null,
      cnesCode: null,
      city: null,
      state: null,
      latitude: null,
      longitude: null,
      deactivatedAt: null,
    });

    expect(document).toHaveProperty("unitTypeId", null);
    expect(document).toHaveProperty("legalDocumentType", null);
    expect(document).toHaveProperty("clinicalFocusIds", []);
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

/**
 * Unscoped funnel filters ask "does the clinic have *a* profile like this",
 * which is what the SQL EXISTS asks. Answering them from the per-facility
 * minimum turned that into "every profile", and a multi-vertical clinic
 * disappeared from a filter it belongs in — in the one direction the API's
 * hydrate guard never catches, since that only fires when Meili returns rows SQL
 * then rejects.
 */
describe("unscoped multi-profile funnel fields", () => {
  const profiles = [
    {
      verticalId: 10,
      purchaseFunnelStage: "PURCHASE_WINDOW" as const,
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "CALCULATED" as const,
      manualPurchaseProfile: null,
      lastValidPurchaseDate: "2026-07-01",
    },
    {
      verticalId: 11,
      purchaseFunnelStage: "CHURN" as const,
      purchaseIntervalDays: 90,
      purchaseIntervalSource: "MANUAL" as const,
      manualPurchaseProfile: "QUARTERLY" as const,
      lastValidPurchaseDate: "2026-01-01",
    },
  ];

  it("spans the profiles from shortest to longest interval", () => {
    expect(deriveFacilityProfileFunnelFields(profiles)).toMatchObject({
      // "at least 60 days" has to match this clinic — its quarterly line
      // qualifies — so the lower bound is tested against the maximum.
      purchaseIntervalDaysMax: 90,
      // "at most 60 days" has to match it too, via the monthly line.
      purchaseIntervalDaysMin: 30,
    });
  });

  it("reports every source and manual profile present, not only a unanimous one", () => {
    expect(deriveFacilityProfileFunnelFields(profiles)).toMatchObject({
      purchaseIntervalSourcesAny: ["CALCULATED", "MANUAL"],
      manualPurchaseProfilesAny: ["QUARTERLY"],
    });
  });

  it("leaves the manual list empty when every profile is automatic", () => {
    expect(deriveFacilityProfileFunnelFields([profiles[0]!])).toMatchObject({
      manualPurchaseProfilesAny: [],
      purchaseIntervalSourcesAny: ["CALCULATED"],
      purchaseIntervalDaysMin: 30,
      purchaseIntervalDaysMax: 30,
    });
  });

  it("falls back to the default interval on both bounds with no profiles", () => {
    expect(deriveFacilityProfileFunnelFields([])).toMatchObject({
      purchaseIntervalDaysMin: 30,
      purchaseIntervalDaysMax: 30,
      purchaseIntervalSourcesAny: [],
      manualPurchaseProfilesAny: [],
    });
  });
});
