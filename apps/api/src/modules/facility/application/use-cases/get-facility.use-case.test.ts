import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import { GetFacilityUseCase } from "./facility.use-cases";
import type {
  FacilityRecord,
  FacilityRepository,
} from "../interfaces/facility.repository.interface";

const now = new Date("2026-01-01T00:00:00.000Z");

const ortopediaId = "vertical-orto";
const dermatologiaId = "vertical-derm";

function baseScope(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return {
    isGlobal: false,
    assignedTerritoryIds: ["territory-1"],
    effectiveTerritoryIds: ["territory-1"],
    analyticsEffectiveTerritoryIds: ["territory-1"],
    territoryIds: ["territory-1"],
    facilityIds: ["facility-1"],
    analyticsFacilityIds: ["facility-1"],
    clinicIds: ["facility-1"],
    analyticsClinicIds: ["facility-1"],
    managedUserIds: [],
    isOperationallyActive: true,
    assignedVerticalIds: [ortopediaId, dermatologiaId],
    ...overrides,
  };
}

function ortoOnlyFacility(): FacilityRecord {
  return {
    id: "facility-1",
    name: "CLINICA ORTOPEDICA SERGIO CORDEIRO CENTRO",
    neighborhood: null,
    city: null,
    state: null,
    streetAddress: null,
    streetNumber: null,
    addressComplement: null,
    postalCode: null,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    billingEmail: null,
    responsibleName: null,
    openingHours: null,
    taxIdType: "PJ",
    cnpj: null,
    cpf: null,
    lat: -22.9,
    lng: -43.1,
    territoryId: "territory-1",
    territoryName: null,
    territoryAssignmentStatus: "assigned",
    territoryAssignmentSource: "manual",
    commercialStatus: null,
    purchaseStatus: null,
    observedPurchaseIntervalDays: null,
    purchaseIntervalDays: 30,
    purchaseIntervalSource: "DEFAULT",
    manualPurchaseProfile: null,
    manualPurchaseIntervalDays: null,
    lastValidPurchaseDate: null,
    purchaseRecurrenceSampleSize: 0,
    purchaseFunnelStage: "NEVER_PURCHASED",
    nextPurchaseFunnelTransitionDate: null,
    conformityStatus: "INCOMPLETE",
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
    services: [],
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
        territoryId: "territory-1",
      },
    ],
  };
}

function repoWith(facility: FacilityRecord | null): FacilityRepository {
  return {
    findAll: async () => ({ facilities: [], total: 0 }),
    findAllByIds: async () => [],
    findById: async () => facility,
    listServiceCatalog: async () => [],
    findByExternalId: async () => null,
    findSourceTrackedByProvider: async () => [],
    create: async () => facility ?? ortoOnlyFacility(),
    update: async () => facility ?? ortoOnlyFacility(),
    softDelete: async () => {},
    reactivate: async () => facility ?? ortoOnlyFacility(),
    markSourceAbsent: async () => {},
    upsertFromSource: async () => ({
      facility: facility ?? ortoOnlyFacility(),
      created: true,
      updated: false,
    }),
    findIdsByTerritoryIds: async () => [],
    listMapPoints: async () => [],
    applyApprovedFieldUpdates: async () => facility ?? ortoOnlyFacility(),
    findActiveFacilityIdsByVerticalIds: async (verticalIds) =>
      verticalIds.includes(ortopediaId) ? ["facility-1"] : [],
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
      facilityId: "facility-1",
      scope: baseScope(),
      role: Role.REP,
      verticalId: dermatologiaId,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("facility-1");
    expect(result?.verticalProfiles?.map((p) => p.verticalId)).toEqual([
      ortopediaId,
    ]);
  });

  it("returns null when clinic has no profile in the user's assigned Linhas", async () => {
    const useCase = new GetFacilityUseCase({
      facilityRepository: repoWith(ortoOnlyFacility()),
    });

    const result = await useCase.execute({
      facilityId: "facility-1",
      scope: baseScope({ assignedVerticalIds: [dermatologiaId] }),
      role: Role.REP,
      verticalId: dermatologiaId,
    });

    expect(result).toBeNull();
  });
});
