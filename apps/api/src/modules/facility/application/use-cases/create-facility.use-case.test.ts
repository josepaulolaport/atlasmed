import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import {
  CreateFacilityUseCase,
  GetFacilityUseCase,
  ListFacilitiesUseCase,
} from "./facility.use-cases";
import type {
  FacilityListRecord,
  FacilityRecord,
  FacilityRepository,
  FacilityVerticalProfileRecord,
} from "../interfaces/facility.repository.interface";
import { ForbiddenError, ValidationError } from "../../../../shared/errors";

const now = new Date("2026-01-01T00:00:00.000Z");

const ortopediaId = 10;
const dermatologiaId = 20;

function verticalProfile(verticalId: number): FacilityVerticalProfileRecord {
  return {
    verticalId,
    verticalCode: verticalId === ortopediaId ? "ORTOPEDIA" : "DERMATOLOGIA",
    verticalName: verticalId === ortopediaId ? "Ortopédica" : "Dermatológica",
    isActive: true,
    commercialStatus: null,
  };
}

function scopeFor(verticalIds: number[], facilityIds: number[]): ScopeContext {
  return {
    isGlobal: false,
    assignedTerritoryIds: [1],
    effectiveTerritoryIds: [1],
    analyticsEffectiveTerritoryIds: [1],
    territoryIds: [1],
    facilityIds,
    analyticsFacilityIds: facilityIds,
    clinicIds: facilityIds,
    analyticsClinicIds: facilityIds,
    managedUserIds: [],
    isOperationallyActive: true,
    assignedVerticalIds: verticalIds,
  };
}

/**
 * An ADMIN as `scope-resolver.service.ts` actually builds one: global, and
 * holding *every* vertical rather than an assigned subset. That distinction is
 * the whole point of the ADMIN cases below — see the describe block.
 */
function globalScopeFor(verticalIds: number[]): ScopeContext {
  return {
    isGlobal: true,
    assignedTerritoryIds: [],
    effectiveTerritoryIds: [],
    analyticsEffectiveTerritoryIds: [],
    territoryIds: [],
    facilityIds: [],
    analyticsFacilityIds: [],
    clinicIds: [],
    analyticsClinicIds: [],
    managedUserIds: [],
    isOperationallyActive: true,
    assignedVerticalIds: verticalIds,
  };
}

/**
 * Minimal in-memory facility store that reproduces the production visibility
 * rule: a non-global scope only ever sees facilities that have an active
 * profile in one of the scoped verticals.
 */
function inMemoryRepository(): FacilityRepository & {
  profilesOf(facilityId: number): FacilityVerticalProfileRecord[];
} {
  const stored = new Map<number, FacilityRecord>();
  let nextId = 1;

  const record = (
    id: number,
    name: string,
    profiles: FacilityVerticalProfileRecord[],
  ): FacilityRecord => ({
    id,
    name,
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
    lat: null,
    lng: null,
    territoryId: 1,
    territoryName: null,
    territoryAssignmentStatus: "assigned",
    commercialStatus: null,
    cnesCode: null,
    unitTypeId: null,
    unitSubtypeId: null,
    deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    clinicalFocuses: [],
    consultantName: null,
    consultantSince: null,
    managerName: null,
    imageUrl: null,
    imageBlurhash: null,
    verticalProfiles: profiles,
  });

  const visible = (
    facility: FacilityRecord,
    scope: { restrictToVerticalProfiles?: boolean; verticalIds?: number[] },
  ) => {
    if (!scope.restrictToVerticalProfiles) return true;
    const verticalIds = scope.verticalIds ?? [];
    if (verticalIds.length === 0) return false;
    return (facility.verticalProfiles ?? []).some(
      (profile) => profile.isActive && verticalIds.includes(profile.verticalId),
    );
  };

  const repository: FacilityRepository & {
    profilesOf(facilityId: number): FacilityVerticalProfileRecord[];
  } = {
    findAll: async ({ scope }) => {
      const facilities = [...stored.values()].filter((facility) =>
        visible(facility, scope),
      ) as unknown as FacilityListRecord[];
      return { facilities, total: facilities.length };
    },
    findAllByIds: async () => [],
    findById: async (id) => stored.get(id) ?? null,
    listClinicalFocusCatalog: async () => [],
    create: async (data) => {
      const id = nextId++;
      // Mirrors the adapter contract: facility and profile land together.
      const created = record(id, data.name, [verticalProfile(data.verticalId)]);
      stored.set(id, created);
      return created;
    },
    update: async (id) => stored.get(id)!,
    softDelete: async () => {},
    reactivate: async (id) => stored.get(id)!,
    findIdsByTerritoryIds: async () => [],
    listMapPoints: async () => [],
    applyApprovedFieldUpdates: async (id) => stored.get(id)!,
    findActiveFacilityIdsByVerticalIds: async () => [],
    findVerticalProfilesByFacilityIds: async () => new Map(),
    updateVerticalProfileCommercialStatus: async () => {},
    ensureVerticalProfile: async ({ verticalId }) => verticalProfile(verticalId),
    profilesOf: (facilityId) => stored.get(facilityId)?.verticalProfiles ?? [],
  };

  return repository;
}

describe("CreateFacilityUseCase", () => {
  it("creates the vertical profile so the clinic stays visible to a non-global scope", async () => {
    const repository = inMemoryRepository();
    const created = await new CreateFacilityUseCase({
      facilityRepository: repository,
    }).execute({
      name: "CLINICA NOVA",
      stateId: 1,
      municipalityId: 1,
      legalDocumentType: "CNPJ",
      verticalId: ortopediaId,
      role: Role.REP,
      scope: scopeFor([ortopediaId], []),
    });

    expect(repository.profilesOf(created.id).map((p) => p.verticalId)).toEqual([
      ortopediaId,
    ]);

    const scope = scopeFor([ortopediaId], [created.id]);

    const listed = await new ListFacilitiesUseCase({
      facilityRepository: repository,
    }).execute({ userId: 1, role: Role.REP, scope });
    expect(listed.data.map((facility) => facility.id)).toEqual([created.id]);

    const detail = await new GetFacilityUseCase({
      facilityRepository: repository,
    }).execute({ facilityId: created.id, scope, role: Role.REP });
    expect(detail).not.toBeNull();
    expect(detail?.verticalProfiles?.map((p) => p.verticalId)).toEqual([
      ortopediaId,
    ]);
  });

  it("uses the caller's only vertical when verticalId is omitted", async () => {
    const repository = inMemoryRepository();
    const created = await new CreateFacilityUseCase({
      facilityRepository: repository,
    }).execute({
      name: "CLINICA UNICA LINHA",
      stateId: 1,
      municipalityId: 1,
      legalDocumentType: "CNPJ",
      role: Role.REP,
      scope: scopeFor([dermatologiaId], []),
    });

    expect(repository.profilesOf(created.id).map((p) => p.verticalId)).toEqual([
      dermatologiaId,
    ]);
  });

  it("rejects a verticalId outside the caller's assignments", async () => {
    const repository = inMemoryRepository();
    const useCase = new CreateFacilityUseCase({
      facilityRepository: repository,
    });

    await expect(
      useCase.execute({
        name: "CLINICA PROIBIDA",
        stateId: 1,
        municipalityId: 1,
        legalDocumentType: "CNPJ",
        verticalId: dermatologiaId,
        role: Role.REP,
        scope: scopeFor([ortopediaId], []),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("fails clearly when a multi-vertical caller omits verticalId", async () => {
    const repository = inMemoryRepository();
    const useCase = new CreateFacilityUseCase({
      facilityRepository: repository,
    });

    await expect(
      useCase.execute({
        name: "CLINICA AMBIGUA",
        stateId: 1,
        municipalityId: 1,
        legalDocumentType: "CNPJ",
        role: Role.REP,
        scope: scopeFor([ortopediaId, dermatologiaId], []),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

/**
 * Every case above runs as a REP. An ADMIN is not just "a REP with more rows":
 * `scope-resolver.service.ts` gives an ADMIN *all* verticals rather than an
 * assigned subset, and `resolveAccessibleVerticalIds` keys entirely off
 * `assignedVerticalIds` — role is explicitly unused there.
 *
 * The consequence is counter-intuitive enough that PR #201's description got it
 * wrong: on a multi-vertical database an ADMIN who omits `verticalId` does not
 * create a clinic in some default linha, and does not bypass the check for
 * being global. It gets a ValidationError, because "all verticals" is the
 * ambiguous case. These tests pin that down so it is not re-discovered from a
 * production report.
 */
describe("CreateFacilityUseCase — ADMIN (global scope, all verticals)", () => {
  it("rejects an omitted verticalId once more than one vertical exists", async () => {
    const repository = inMemoryRepository();

    await expect(
      new CreateFacilityUseCase({ facilityRepository: repository }).execute({
        name: "CLINICA ADMIN AMBIGUA",
        stateId: 1,
        municipalityId: 1,
        legalDocumentType: "CNPJ",
        role: Role.ADMIN,
        scope: globalScopeFor([ortopediaId, dermatologiaId]),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("creates the profile when the ADMIN names the vertical explicitly", async () => {
    const repository = inMemoryRepository();

    const created = await new CreateFacilityUseCase({
      facilityRepository: repository,
    }).execute({
      name: "CLINICA ADMIN",
      stateId: 1,
      municipalityId: 1,
      legalDocumentType: "CNPJ",
      verticalId: dermatologiaId,
      role: Role.ADMIN,
      scope: globalScopeFor([ortopediaId, dermatologiaId]),
    });

    expect(repository.profilesOf(created.id).map((p) => p.verticalId)).toEqual([
      dermatologiaId,
    ]);

    // The clinic an ADMIN creates must also be visible to the REP who works
    // that linha — creating it globally is worthless if the field cannot see it.
    const repScope = scopeFor([dermatologiaId], [created.id]);
    const detail = await new GetFacilityUseCase({
      facilityRepository: repository,
    }).execute({ facilityId: created.id, scope: repScope, role: Role.REP });

    expect(detail).not.toBeNull();
    expect(detail?.verticalProfiles?.map((p) => p.verticalId)).toEqual([
      dermatologiaId,
    ]);
  });

  it("uses the single vertical when only one exists in the database", async () => {
    const repository = inMemoryRepository();

    const created = await new CreateFacilityUseCase({
      facilityRepository: repository,
    }).execute({
      name: "CLINICA ADMIN UNICA",
      stateId: 1,
      municipalityId: 1,
      legalDocumentType: "CNPJ",
      role: Role.ADMIN,
      scope: globalScopeFor([ortopediaId]),
    });

    expect(repository.profilesOf(created.id).map((p) => p.verticalId)).toEqual([
      ortopediaId,
    ]);
  });

  it("rejects creation when the scope carries no verticals at all", async () => {
    const repository = inMemoryRepository();

    await expect(
      new CreateFacilityUseCase({ facilityRepository: repository }).execute({
        name: "CLINICA SEM LINHA",
        stateId: 1,
        municipalityId: 1,
        legalDocumentType: "CNPJ",
        role: Role.ADMIN,
        scope: globalScopeFor([]),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
