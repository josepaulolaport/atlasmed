import { describe, expect, it } from "bun:test";
import { buildFacilityUpsertDocument } from "./facility-search-index.service";

/**
 * The incremental upsert and the Temporal full rebuild build the same Meili
 * document from two separate pieces of code. Drift between them is invisible:
 * the rebuild produces correct documents, and every later edit rewrites that
 * facility with a field missing, so it quietly stops matching a filter it
 * should match. Nothing errors and nothing is logged.
 *
 * These pin the fields Explorar filters on.
 */
const row = {
  id: 1,
  displayName: "Clínica Central",
  legalName: null,
  tradeName: null,
  legalDocument: null,
  cnesCode: null,
  city: "São Paulo",
  state: "SP",
  streetAddress: null,
  neighborhood: null,
  unitTypeId: 3,
  legalDocumentType: "CNPJ",
  latitude: null,
  longitude: null,
  deactivatedAt: null,
};

const noAssociations = {
  verticalIds: [],
  territoryIds: [],
  repUserIds: [],
  clinicalFocusIds: [],
  profiles: [],
};

describe("buildFacilityUpsertDocument", () => {
  it("carries every filterable attribute Explorar uses", () => {
    expect(
      buildFacilityUpsertDocument({
        row,
        verticalIds: [10],
        territoryIds: [20],
        repUserIds: [7],
        clinicalFocusIds: [9, 4],
        profiles: [],
      }),
    ).toMatchObject({
      id: "1",
      unitTypeId: 3,
      legalDocumentType: "CNPJ",
      clinicalFocusIds: [4, 9],
      verticalIds: [10],
      territoryIds: [20],
      repUserIds: [7],
    });
  });

  it("emits empty rather than absent values when a facility has none", () => {
    // Meili cannot filter an attribute that some documents omit.
    const document = buildFacilityUpsertDocument({
      row: { ...row, unitTypeId: null, legalDocumentType: null },
      ...noAssociations,
    });

    expect(document).toHaveProperty("unitTypeId", null);
    expect(document).toHaveProperty("legalDocumentType", null);
    expect(document).toHaveProperty("clinicalFocusIds", []);
  });

  it("returns null for a deactivated facility so the caller deletes it", () => {
    expect(
      buildFacilityUpsertDocument({
        row: { ...row, deactivatedAt: new Date("2026-01-01T00:00:00.000Z") },
        ...noAssociations,
      }),
    ).toBeNull();
  });

  it("truncates the last purchase date to a plain day", () => {
    // It arrives as a Date or a timestamp string depending on the driver, and
    // the rebuild slices it the same way.
    const document = buildFacilityUpsertDocument({
      ...noAssociations,
      row,
      profiles: [
        {
          verticalId: 10,
          purchaseFunnelStage: "PURCHASE_WINDOW",
          purchaseIntervalDays: 30,
          purchaseIntervalSource: "DEFAULT",
          manualPurchaseProfile: null,
          lastValidPurchaseDate: "2026-07-01T00:00:00.000Z",
        },
      ],
    });

    expect(document?.hasLastValidPurchase).toBe(1);
  });
});
