import { describe, expect, it } from "bun:test";
import { serializeFacility } from "./facility.mapper";
import type { FacilityListRecord } from "../interfaces/facility.repository.interface";

const now = new Date("2026-01-01T00:00:00.000Z");

const defaultPurchaseRecurrence = {
  observedPurchaseIntervalDays: null,
  purchaseIntervalDays: 30,
  purchaseIntervalSource: "DEFAULT" as const,
  manualPurchaseProfile: null,
  manualPurchaseIntervalDays: null,
  lastValidPurchaseDate: null,
  purchaseRecurrenceSampleSize: 0,
  purchaseFunnelStage: "NEVER_PURCHASED" as const,
  nextPurchaseFunnelTransitionDate: null,
};

function baseFacility(
  overrides: Partial<FacilityListRecord> = {}
): FacilityListRecord {
  return {
    id: 1,
    name: "Clínica Exemplo",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    streetAddress: "Av. Paulista",
    streetNumber: "1000",
    addressComplement: "Conj. 12",
    postalCode: "01310-100",
    stateId: 1,
    municipalityId: 2,
    phone: "1130405060",
    whatsapp: "11987654321",
    email: "contato@exemplo.com",
    website: "https://exemplo.com",
    billingEmail: "financeiro@exemplo.com",
    responsibleName: "Dr. Silva",
    openingHours: "Seg–Sex 08:00–18:00",
    legalDocumentType: "CNPJ",
    legalDocument: "12345678000199",
    lat: -23.5614,
    lng: -46.6559,
    territoryId: 1,
    territoryName: "Zona Sul",
    territoryAssignmentStatus: "assigned",
    commercialStatus: null,
    consultantName: "Ana Silva",
    consultantSince: new Date("2023-03-01T00:00:00.000Z"),
    managerName: "Roberto Mendes",
    imageUrl: null,
    imageBlurhash: null,
    cnesCode: null,
    unitTypeId: null,
    unitSubtypeId: null,
    deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    clinicalFocuses: [
      {
        id: 1,
        name: "Ortopedia",
        cnesCode: "155",
      },
    ],
    verticalProfiles: [
      {
        id: 901,
        verticalId: 1,
        verticalCode: "ORTOPEDIA",
        verticalName: "Ortopedia",
        isActive: true,
        commercialStatus: "REGISTERED",
        purchaseRecurrence: defaultPurchaseRecurrence,
      },
    ],
    professionalCount: 4,
    lastVisitAt: null,
    distanceKm: 1.2,
    ...overrides,
  };
}

describe("serializeFacility", () => {
  it("exposes Spec 0005 F-001 identity, contact, address, and coordinates", () => {
    const dto = serializeFacility(baseFacility());

    expect(dto).toMatchObject({
      id: 1,
      name: "Clínica Exemplo",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      streetAddress: "Av. Paulista",
      streetNumber: "1000",
      addressComplement: "Conj. 12",
      postalCode: "01310-100",
      phone: "1130405060",
      whatsapp: "11987654321",
      email: "contato@exemplo.com",
      website: "https://exemplo.com",
      billingEmail: "financeiro@exemplo.com",
      responsibleName: "Dr. Silva",
      openingHours: "Seg–Sex 08:00–18:00",
      registeredSince: now.toISOString(),
      legalDocumentType: "CNPJ",
      legalDocument: "12345678000199",
      lat: -23.5614,
      lng: -46.6559,
      consultantName: "Ana Silva",
      consultantSince: "2023-03-01T00:00:00.000Z",
      managerName: "Roberto Mendes",
      territoryName: "Zona Sul",
      professionalCount: 4,
      distanceKm: 1.2,
      unitTypeId: undefined,
      unitSubtypeId: undefined,
      clinicalFocuses: [
        {
          id: 1,
          name: "Ortopedia",
          cnesCode: "155",
        },
      ],
    });
    expect(dto).not.toHaveProperty("commercialStatus");
    expect(dto).not.toHaveProperty("purchaseStatus");
    expect(dto).not.toHaveProperty("purchaseRecurrence");
    expect(dto.verticalProfiles).toEqual([
      expect.objectContaining({
        verticalId: 1,
        commercialStatus: "REGISTERED",
      }),
    ]);
    expect(dto.createdAt).toBe(now.toISOString());
  });

  it("omits lat/lng when coordinates are missing", () => {
    const dto = serializeFacility(baseFacility({ lat: null, lng: null }));

    expect(dto.lat).toBeUndefined();
    expect(dto.lng).toBeUndefined();
  });

  it("exposes derived territoryAssignmentStatus without source", () => {
    const assigned = serializeFacility(baseFacility({ territoryAssignmentStatus: "assigned" }));
    const unassigned = serializeFacility(
      baseFacility({ territoryId: null, territoryAssignmentStatus: "unassigned" }),
    );

    expect(assigned.territoryAssignmentStatus).toBe("assigned");
    expect(unassigned.territoryAssignmentStatus).toBe("unassigned");
    expect("territoryAssignmentSource" in assigned).toBe(false);
  });

  it("serializes the requesting user's latest visit when present", () => {
    const lastVisitAt = new Date("2025-12-20T14:30:00.000Z");

    const dto = serializeFacility(baseFacility({ lastVisitAt }));

    expect(dto.lastVisitAt).toBe(lastVisitAt.toISOString());
  });
  it("returns null nextEstimatedPurchaseDate when there is no last purchase", () => {
    const dto = serializeFacility(baseFacility());

    expect(dto.verticalProfiles![0]!.purchaseRecurrence!.nextEstimatedPurchaseDate).toBeNull();
  });

  it("calculates nextEstimatedPurchaseDate from last purchase date + interval", () => {
    const dto = serializeFacility(
      baseFacility({
        verticalProfiles: [{
          id: 902,
          verticalId: 1,
          isActive: true,
          commercialStatus: "REGISTERED",
          purchaseRecurrence: {
            ...defaultPurchaseRecurrence,
            lastValidPurchaseDate: "2025-12-15",
            purchaseIntervalDays: 30,
          },
        }],
      }),
    );

    expect(dto.verticalProfiles![0]!.purchaseRecurrence!.nextEstimatedPurchaseDate).toBe(
      "2026-01-14T00:00:00.000Z",
    );
  });

  it("calculates nextEstimatedPurchaseDate with a 7-day interval", () => {
    const dto = serializeFacility(
      baseFacility({
        verticalProfiles: [{
          id: 902,
          verticalId: 1,
          isActive: true,
          commercialStatus: "REGISTERED",
          purchaseRecurrence: {
            ...defaultPurchaseRecurrence,
            lastValidPurchaseDate: "2026-01-10",
            purchaseIntervalDays: 7,
          },
        }],
      }),
    );

    expect(dto.verticalProfiles![0]!.purchaseRecurrence!.nextEstimatedPurchaseDate).toBe(
      "2026-01-17T00:00:00.000Z",
    );
  });

});

describe("date fields the driver may hand back as strings", () => {
  /*
   * Production, 2026-08-16: every `/facilities` page and every
   * `/dashboard/metrics/*\/clinics` drilldown 500'd with
   *
   *   TypeError: list.lastVisitAt?.toISOString is not a function
   *
   * `lastVisitAt` came from `sql<Date>\`max(visited_at)\``, which asserts a type
   * rather than producing one — the driver returns a string for a bare
   * template, and `?.` only guards the null. One visited clinic anywhere in a
   * page took the whole page down, which is why a local database with no visits
   * never showed it.
   */
  it("serialises a string lastVisitAt instead of throwing", () => {
    const facility = baseFacility();
    const withStringDate = {
      ...facility,
      lastVisitAt: "2026-08-10 14:32:00+00" as unknown as Date,
    } as FacilityListRecord;

    const dto = serializeFacility(withStringDate);

    expect(dto.lastVisitAt).toBe(new Date("2026-08-10 14:32:00+00").toISOString());
  });

  it("still serialises a real Date", () => {
    const facility = baseFacility();
    const visited = new Date("2026-08-10T14:32:00.000Z");

    const dto = serializeFacility({
      ...facility,
      lastVisitAt: visited,
    } as FacilityListRecord);

    expect(dto.lastVisitAt).toBe(visited.toISOString());
  });

  it("leaves lastVisitAt out when there is no visit", () => {
    const dto = serializeFacility(baseFacility());
    expect(dto.lastVisitAt).toBeUndefined();
  });

  it("drops an unparseable value rather than failing the page", () => {
    const dto = serializeFacility({
      ...baseFacility(),
      lastVisitAt: "not a date" as unknown as Date,
    } as FacilityListRecord);

    expect(dto.lastVisitAt).toBeUndefined();
  });

  it("applies the same rule to consultantSince", () => {
    const dto = serializeFacility({
      ...baseFacility(),
      consultantSince: "2026-07-01 09:00:00+00" as unknown as Date,
    } as FacilityListRecord);

    expect(dto.consultantSince).toBe(
      new Date("2026-07-01 09:00:00+00").toISOString(),
    );
  });
});
