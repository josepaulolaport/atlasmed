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
    commercialStatus: "ACTIVE",
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
      commercialStatus: "ACTIVE",
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
});
