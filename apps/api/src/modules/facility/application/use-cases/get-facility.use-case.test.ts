import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import { GetFacilityUseCase } from "./facility.use-cases";
import type {
  FacilityRecord,
  FacilityRepository,
} from "../interfaces/facility.repository.interface";

const now = new Date("2026-01-01T00:00:00.000Z");

const ortopediaId = 10;
const dermatologiaId = 20;

function baseScope(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return {
    isGlobal: false,
    assignedTerritoryIds: [1],
    effectiveTerritoryIds: [1],
    analyticsEffectiveTerritoryIds: [1],
    territoryIds: [1],
    facilityIds: [1],
    analyticsFacilityIds: [1],
    clinicIds: [1],
    analyticsClinicIds: [1],
    managedUserIds: [],
    isOperationallyActive: true,
    assignedVerticalIds: [ortopediaId, dermatologiaId],
    ...overrides,
  };
}

function ortoOnlyFacility(): FacilityRecord {
  return {
    id: 1,
    name: "CLINICA ORTOPEDICA SERGIO CORDEIRO CENTRO",
    neighborhood: null,
    city: null,
    state: null,
    streetAddress: null,
    streetNumber: null,
    addressComplement: null,
    postalCode: null,
    stateId: 1,
    municipalityId: 1,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    billingEmail: null,
    responsibleName: null,
    openingHours: null,
    legalDocumentType: "CNPJ",
    legalDocument: null,
    lat: -22.9,
    lng: -43.1,
    territoryId: 1,
    territoryName: null,
    territoryAssignmentStatus: "assigned",
    commercialStatus: null,
    purchaseStatus: null,
    conformityStatus: "INCOMPLETE",
    cnesCode: null,
    facilityTypeCode: null,
    unitTypeCode: null,
    unitSubtypeCode: null,
        deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    clinicalFocuses: [],
    consultantName: null,
    consultantSince: null,
    managerName: null,
    imageUrl: null,
    imageBlurhash: null,
    verticalProfiles: [
      {
        verticalId: ortopediaId,
        verticalCode: "ORTOPEDIA",
        verticalName: "Ortopédica",
        isActive: true,
        commercialStatus: "UNREGISTERED",
        purchaseStatus: "NON_BUYER",
        territoryId: 1,
      },
    ],
  };
}

function repoWith(facility: FacilityRecord | null): FacilityRepository {
  return {
    findAll: async () => ({ facilities: [], total: 0 }),
    findAllByIds: async () => [],
    findById: async () => facility,
    listClinicalFocusCatalog: async () => [],
    create: async () => facility ?? ortoOnlyFacility(),
    update: async () => facility ?? ortoOnlyFacility(),
    softDelete: async () => {},
    reactivate: async () => facility ?? ortoOnlyFacility(),
    findIdsByTerritoryIds: async () => [],
    listMapPoints: async () => [],
    applyApprovedFieldUpdates: async () => facility ?? ortoOnlyFacility(),
    findActiveFacilityIdsByVerticalIds: async (verticalIds) =>
      verticalIds.includes(ortopediaId) ? [1] : [],
    findVerticalProfilesByFacilityIds: async () => new Map(),
    updateVerticalProfileCommercialStatus: async () => {},
    ensureVerticalProfile: async () => ({
      verticalId: ortopediaId,
      verticalCode: "ORTOPEDIA",
      verticalName: "Ortopédica",
      isActive: true,
      commercialStatus: null,
      purchaseStatus: null,
    }),
  };
}

describe("GetFacilityUseCase", () => {
  it("returns an Orto-only clinic even when detail Linha filter is Derm", async () => {
    const useCase = new GetFacilityUseCase({
      facilityRepository: repoWith(ortoOnlyFacility()),
    });

    const result = await useCase.execute({
      facilityId: 1,
      scope: baseScope(),
      role: Role.REP,
      verticalId: dermatologiaId,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.verticalProfiles?.map((p) => p.verticalId)).toEqual([
      ortopediaId,
    ]);
  });

  it("returns null when clinic has no profile in the user's assigned Linhas", async () => {
    const useCase = new GetFacilityUseCase({
      facilityRepository: repoWith(ortoOnlyFacility()),
    });

    const result = await useCase.execute({
      facilityId: 1,
      scope: baseScope({ assignedVerticalIds: [dermatologiaId] }),
      role: Role.REP,
      verticalId: dermatologiaId,
    });

    expect(result).toBeNull();
  });
});
