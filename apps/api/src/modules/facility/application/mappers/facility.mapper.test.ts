import { describe, expect, it } from "bun:test";
import { serializeFacility } from "./facility.mapper";
import type { FacilityListRecord } from "../interfaces/facility.repository.interface";

const now = new Date("2026-01-01T00:00:00.000Z");

function baseFacility(
  overrides: Partial<FacilityListRecord> = {}
): FacilityListRecord {
  return {
    id: "facility-1",
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
    taxIdType: "PJ",
    cnpj: "12345678000199",
    cpf: null,
    lat: -23.5614,
    lng: -46.6559,
    territoryId: "territory-1",
    territoryName: "Zona Sul",
    territoryAssignmentStatus: "assigned",
    territoryAssignmentSource: "geo",
    commercialStatus: "REGISTERED",
    purchaseStatus: "REGULAR_BUYER",
    observedPurchaseIntervalDays: null,
    purchaseIntervalDays: 30,
    purchaseIntervalSource: "DEFAULT" as const,
    manualPurchaseProfile: null,
    manualPurchaseIntervalDays: null,
    lastValidPurchaseDate: null,
    purchaseRecurrenceSampleSize: 0,
    purchaseFunnelStage: "NEVER_PURCHASED" as const,
    nextPurchaseFunnelTransitionDate: null,
    conformityStatus: "COMPLETE",
    consultantName: "Ana Silva",
    consultantSince: new Date("2023-03-01T00:00:00.000Z"),
    managerName: "Roberto Mendes",
    imageUrl: null,
    imageBlurhash: null,
    sourceProvider: null,
    externalSourceId: null,
    sourceContentHash: null,
    sourceFirstSeenAt: null,
    sourceLastSeenAt: null,
    sourcePresent: true,
    sourceTracked: false,
    manuallyEditedAt: null,
    deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    services: [{ serviceCode: "123", classificationCode: "01" }],
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
      id: "facility-1",
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
      taxIdType: "PJ",
      cnpj: "12345678000199",
      lat: -23.5614,
      lng: -46.6559,
      commercialStatus: "REGISTERED",
      conformityStatus: "COMPLETE",
      consultantName: "Ana Silva",
      consultantSince: "2023-03-01T00:00:00.000Z",
      managerName: "Roberto Mendes",
      territoryName: "Zona Sul",
      professionalCount: 4,
      distanceKm: 1.2,
      services: [{ serviceCode: "123", classificationCode: "01" }],
    });
    expect(dto).not.toHaveProperty("purchaseStatus");
    expect(dto.createdAt).toBe(now.toISOString());
  });

  it("omits lat/lng when coordinates are missing", () => {
    const dto = serializeFacility(baseFacility({ lat: null, lng: null }));

    expect(dto.lat).toBeUndefined();
    expect(dto.lng).toBeUndefined();
  });

  it("serializes the requesting user's latest visit when present", () => {
    const lastVisitAt = new Date("2025-12-20T14:30:00.000Z");

    const dto = serializeFacility(baseFacility({ lastVisitAt }));

    expect(dto.lastVisitAt).toBe(lastVisitAt.toISOString());
  });
  it("returns null nextEstimatedPurchaseDate when there is no last purchase", () => {
    const dto = serializeFacility(
      baseFacility({ lastValidPurchaseDate: null, purchaseIntervalDays: 30 }),
    );

    expect(dto.purchaseRecurrence.nextEstimatedPurchaseDate).toBeNull();
  });

  it("calculates nextEstimatedPurchaseDate from last purchase date + interval", () => {
    const dto = serializeFacility(
      baseFacility({
        lastValidPurchaseDate: "2025-12-15",
        purchaseIntervalDays: 30,
      }),
    );

    expect(dto.purchaseRecurrence.nextEstimatedPurchaseDate).toBe(
      "2026-01-14T00:00:00.000Z",
    );
  });

  it("calculates nextEstimatedPurchaseDate with a 7-day interval", () => {
    const dto = serializeFacility(
      baseFacility({
        lastValidPurchaseDate: "2026-01-10",
        purchaseIntervalDays: 7,
      }),
    );

    expect(dto.purchaseRecurrence.nextEstimatedPurchaseDate).toBe(
      "2026-01-17T00:00:00.000Z",
    );
  });

});
