import { createGlobalScopeContext } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  PersonFacilityProjectionRecord,
  PersonFacilityProjectionRepository,
} from "../interfaces/person-facility-projection.repository.interface";
import { CLASSIFICATION } from "../interfaces/person-facility-projection.repository.interface";
import {
  EndPersonFacilityAffiliationUseCase,
  PatchPersonFacilityProjectionUseCase,
  ReplacePersonFacilityRolesUseCase,
  UpsertPersonFacilityProjectionUseCase,
} from "./person-facility-projection.use-cases";

const ROLE = {
  PRESCRIBER: 1,
  BUYER: 2,
  DECISION_MAKER: 3,
  PARTNER: 4,
  ADMINISTRATOR: 5,
  BILLER: 6,
  SECRETARY: 7,
} as const;

const CLASSIFICATION_ID = {
  HEALTHCARE_PROFESSIONAL: 1,
  ADMINISTRATIVE_CONTACT: 2,
} as const;

function baseRow(
  overrides: Partial<PersonFacilityProjectionRecord> = {}
): PersonFacilityProjectionRecord {
  return {
    personFacilityId: 10,
    personId: 5,
    facilityId: 1,
    firstName: "Ana",
    lastName: "Silva",
    socialName: null,
    cpf: null,
    email: null,
    mobilePhone: null,
    landlinePhone: null,
    roleTitle: null,
    notes: null,
    hasHealthcareProfile: true,
    classificationIds: [CLASSIFICATION_ID.ADMINISTRATIVE_CONTACT],
    classificationCodes: [CLASSIFICATION.ADMINISTRATIVE_CONTACT],
    roleIds: [],
    endedAt: null,
    ...overrides,
  };
}

const ACTIVE_ROLE_CATALOG = [
  { id: ROLE.PRESCRIBER, name: "Prescritor", isActive: true },
  { id: ROLE.BUYER, name: "Comprador", isActive: true },
  { id: ROLE.DECISION_MAKER, name: "Decisor", isActive: true },
  { id: ROLE.PARTNER, name: "Parceiro", isActive: true },
  { id: ROLE.ADMINISTRATOR, name: "Administrador", isActive: true },
  { id: ROLE.BILLER, name: "Faturamento", isActive: true },
  { id: ROLE.SECRETARY, name: "Secretário(a)", isActive: true },
];

function fakeRoleCatalog() {
  return {
    listActive: async () => ACTIVE_ROLE_CATALOG,
  };
}

function fakeRepo(state: {
  affiliation?: { id: number; facilityId: number; personId: number } | null;
  person?: { id: number; deletedAt: Date | null } | null;
  row?: PersonFacilityProjectionRecord | null;
  crmConflict?: boolean;
}): PersonFacilityProjectionRepository & {
  adds: Array<{ personFacilityId: number; classificationCode: string }>;
  createdAffiliations: number;
  replacedRoles: Array<{ personFacilityId: number; roleIds: number[] }>;
  ended: Array<{ personFacilityId: number; endedByUserId: number }>;
  crmUpserts: Array<{ personId: number; registrationNumber: string; stateCode: string }>;
} {
  const adds: Array<{ personFacilityId: number; classificationCode: string }> = [];
  const replacedRoles: Array<{ personFacilityId: number; roleIds: number[] }> = [];
  const ended: Array<{ personFacilityId: number; endedByUserId: number }> = [];
  const crmUpserts: Array<{
    personId: number;
    registrationNumber: string;
    stateCode: string;
  }> = [];
  let createdAffiliations = 0;
  let nextPfId = 100;
  let current = state.row ?? null;

  return {
    adds,
    replacedRoles,
    ended,
    crmUpserts,
    get createdAffiliations() {
      return createdAffiliations;
    },
    async listActiveByFacilityAndClassification() {
      return current ? [current] : [];
    },
    async findActiveById(id) {
      return current?.personFacilityId === id ? current : null;
    },
    async findActiveAffiliation() {
      return state.affiliation ?? null;
    },
    async findPersonById(id) {
      if (state.person && state.person.id === id) return state.person;
      return state.person ?? { id, deletedAt: null };
    },
    async createPerson() {
      return { id: 99 };
    },
    async ensureHealthcareProfile() {},
    async upsertPrimaryCrmRegistration(input) {
      if (state.crmConflict) return { kind: "conflict" as const };
      crmUpserts.push(input);
      return { kind: "upserted" as const, id: 1 };
    },
    async createAffiliation(input) {
      createdAffiliations += 1;
      const id = nextPfId++;
      current = baseRow({
        personFacilityId: id,
        personId: input.personId,
        facilityId: input.facilityId,
        roleTitle: input.roleTitle ?? null,
        notes: input.notes ?? null,
        classificationIds: [],
        classificationCodes: [],
        roleIds: [],
        hasHealthcareProfile: true,
      });
      return { id };
    },
    async addClassification(input) {
      adds.push(input);
      if (current && current.personFacilityId === input.personFacilityId) {
        if (!current.classificationCodes.includes(input.classificationCode)) {
          const classificationId =
            input.classificationCode === CLASSIFICATION.HEALTHCARE_PROFESSIONAL
              ? CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL
              : CLASSIFICATION_ID.ADMINISTRATIVE_CONTACT;
          current = {
            ...current,
            classificationIds: [...current.classificationIds, classificationId],
            classificationCodes: [
              ...current.classificationCodes,
              input.classificationCode,
            ],
          };
        }
      }
    },
    async updatePerson() {},
    async updateAffiliation() {},
    async endAffiliation(input) {
      if (
        !current ||
        current.personFacilityId !== input.personFacilityId ||
        current.endedAt
      ) {
        return null;
      }
      ended.push({
        personFacilityId: input.personFacilityId,
        endedByUserId: input.endedByUserId,
      });
      current = { ...current, endedAt: input.endedAt };
      return { endedAt: input.endedAt };
    },
    async replaceRoleAssignments(input) {
      replacedRoles.push(input);
      if (current && current.personFacilityId === input.personFacilityId) {
        current = {
          ...current,
          roleIds: [...input.roleIds],
        };
      }
    },
  };
}

describe("UpsertPersonFacilityProjectionUseCase", () => {
  it("adds classification to existing active affiliation (D5)", async () => {
    const repo = fakeRepo({
      affiliation: { id: 10, facilityId: 1, personId: 5 },
      person: { id: 5, deletedAt: null },
      row: baseRow(),
    });
    const uc = new UpsertPersonFacilityProjectionUseCase({ repository: repo });
    const result = await uc.execute({
      facilityId: 1,
      personId: 5,
      classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
      scope: createGlobalScopeContext(),
    });

    expect(repo.createdAffiliations).toBe(0);
    expect(repo.adds).toEqual([
      {
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
      },
    ]);
    expect(result.classificationIds).toContain(
      CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL
    );
    expect(result.roleIds).toEqual([]);
  });

  it("creates affiliation when none active", async () => {
    const repo = fakeRepo({
      affiliation: null,
      person: { id: 5, deletedAt: null },
      row: null,
    });
    const uc = new UpsertPersonFacilityProjectionUseCase({ repository: repo });
    const result = await uc.execute({
      facilityId: 1,
      personId: 5,
      classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
      scope: createGlobalScopeContext(),
      roleTitle: "CRM",
    });

    expect(repo.createdAffiliations).toBe(1);
    expect(result.personFacilityId).toBe(100);
    expect(repo.adds[0]?.classificationCode).toBe(CLASSIFICATION.HEALTHCARE_PROFESSIONAL);
  });

  it("upserts primary CRM registration on healthcare create", async () => {
    const repo = fakeRepo({
      affiliation: null,
      person: { id: 5, deletedAt: null },
      row: null,
    });
    const uc = new UpsertPersonFacilityProjectionUseCase({ repository: repo });
    await uc.execute({
      facilityId: 1,
      personId: 5,
      classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
      scope: createGlobalScopeContext(),
      crmNumber: "74127",
      crmState: "sp",
    });

    expect(repo.crmUpserts).toEqual([
      { personId: 5, registrationNumber: "74127", stateCode: "SP" },
    ]);
  });

  it("rejects CRM when only one of number/state is provided", async () => {
    const repo = fakeRepo({
      affiliation: null,
      person: { id: 5, deletedAt: null },
      row: null,
    });
    const uc = new UpsertPersonFacilityProjectionUseCase({ repository: repo });
    expect(
      uc.execute({
        facilityId: 1,
        personId: 5,
        classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
        scope: createGlobalScopeContext(),
        crmNumber: "74127",
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.crmUpserts).toEqual([]);
  });

  it("rejects CRM that conflicts with another person", async () => {
    const repo = fakeRepo({
      affiliation: null,
      person: { id: 5, deletedAt: null },
      row: null,
      crmConflict: true,
    });
    const uc = new UpsertPersonFacilityProjectionUseCase({ repository: repo });
    expect(
      uc.execute({
        facilityId: 1,
        personId: 5,
        classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
        scope: createGlobalScopeContext(),
        crmNumber: "74127",
        crmState: "SP",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("PatchPersonFacilityProjectionUseCase", () => {
  it("404s when personFacilityId belongs to another facility", async () => {
    const repo = fakeRepo({
      row: baseRow({
        facilityId: 2,
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
      }),
    });
    const uc = new PatchPersonFacilityProjectionUseCase({ repository: repo });
    expect(
      uc.execute({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
        scope: createGlobalScopeContext(),
        firstName: "X",
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("EndPersonFacilityAffiliationUseCase", () => {
  it("ends active affiliation with actor user id", async () => {
    const repo = fakeRepo({
      row: baseRow({
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
      }),
    });
    const uc = new EndPersonFacilityAffiliationUseCase({ repository: repo });
    const result = await uc.execute({
      facilityId: 1,
      personFacilityId: 10,
      classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
      scope: createGlobalScopeContext(),
      endedByUserId: 42,
    });

    expect(repo.ended).toEqual([{ personFacilityId: 10, endedByUserId: 42 }]);
    expect(result.personFacilityId).toBe(10);
    expect(result.endedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("404s when affiliation already ended", async () => {
    const repo = fakeRepo({
      row: baseRow({
        endedAt: new Date("2026-01-01T00:00:00.000Z"),
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
      }),
    });
    // findActiveById returns row even with endedAt set in fake; use-case checks endedAt
    const uc = new EndPersonFacilityAffiliationUseCase({ repository: repo });
    expect(
      uc.execute({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
        scope: createGlobalScopeContext(),
        endedByUserId: 1,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(repo.ended).toEqual([]);
  });

  it("404s when guarded UPDATE matches zero rows (race)", async () => {
    const repo = fakeRepo({
      row: baseRow({
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
      }),
    });
    // Concurrent end: find still active, guarded UPDATE matches 0 rows.
    repo.endAffiliation = async () => null;

    const uc = new EndPersonFacilityAffiliationUseCase({ repository: repo });
    expect(
      uc.execute({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
        scope: createGlobalScopeContext(),
        endedByUserId: 1,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("404s when personFacilityId belongs to another facility", async () => {
    const repo = fakeRepo({
      row: baseRow({
        facilityId: 2,
        classificationIds: [CLASSIFICATION_ID.ADMINISTRATIVE_CONTACT],
        classificationCodes: [CLASSIFICATION.ADMINISTRATIVE_CONTACT],
      }),
    });
    const uc = new EndPersonFacilityAffiliationUseCase({ repository: repo });
    expect(
      uc.execute({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
        scope: createGlobalScopeContext(),
        endedByUserId: 1,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(repo.ended).toEqual([]);
  });
});

describe("ReplacePersonFacilityRolesUseCase", () => {
  it("replaces role assignments for healthcare affiliation", async () => {
    const repo = fakeRepo({
      row: baseRow({
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
        roleIds: [ROLE.PARTNER],
      }),
    });
    const uc = new ReplacePersonFacilityRolesUseCase({
      repository: repo,
      roleCatalogRepository: fakeRoleCatalog(),
    });
    const result = await uc.execute({
      facilityId: 1,
      personFacilityId: 10,
      classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
      scope: createGlobalScopeContext(),
      roleIds: [ROLE.PRESCRIBER, ROLE.BUYER, ROLE.PRESCRIBER],
    });

    expect(repo.replacedRoles).toEqual([
      { personFacilityId: 10, roleIds: [ROLE.PRESCRIBER, ROLE.BUYER] },
    ]);
    expect(result.roleIds).toEqual([ROLE.PRESCRIBER, ROLE.BUYER]);
  });

  it("allows any seeded catalog role regardless of classification", async () => {
    const repo = fakeRepo({
      row: baseRow({
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
      }),
    });
    const uc = new ReplacePersonFacilityRolesUseCase({
      repository: repo,
      roleCatalogRepository: fakeRoleCatalog(),
    });
    const result = await uc.execute({
      facilityId: 1,
      personFacilityId: 10,
      classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
      scope: createGlobalScopeContext(),
      roleIds: [ROLE.PRESCRIBER, ROLE.SECRETARY],
    });
    expect(result.roleIds).toEqual([ROLE.PRESCRIBER, ROLE.SECRETARY]);
  });

  it("rejects unknown role ids", async () => {
    const repo = fakeRepo({
      row: baseRow({
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
      }),
    });
    const uc = new ReplacePersonFacilityRolesUseCase({
      repository: repo,
      roleCatalogRepository: fakeRoleCatalog(),
    });
    expect(
      uc.execute({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
        scope: createGlobalScopeContext(),
        roleIds: [ROLE.PRESCRIBER, 999],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.replacedRoles).toEqual([]);
  });

  it("404s when personFacilityId belongs to another facility", async () => {
    const repo = fakeRepo({
      row: baseRow({
        facilityId: 2,
        classificationIds: [CLASSIFICATION_ID.ADMINISTRATIVE_CONTACT],
        classificationCodes: [CLASSIFICATION.ADMINISTRATIVE_CONTACT],
      }),
    });
    const uc = new ReplacePersonFacilityRolesUseCase({
      repository: repo,
      roleCatalogRepository: fakeRoleCatalog(),
    });
    expect(
      uc.execute({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
        scope: createGlobalScopeContext(),
        roleIds: [ROLE.BILLER],
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(repo.replacedRoles).toEqual([]);
  });

  it("404s when affiliation lacks the route classification", async () => {
    const repo = fakeRepo({
      row: baseRow({
        classificationIds: [CLASSIFICATION_ID.HEALTHCARE_PROFESSIONAL],
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
      }),
    });
    const uc = new ReplacePersonFacilityRolesUseCase({
      repository: repo,
      roleCatalogRepository: fakeRoleCatalog(),
    });
    expect(
      uc.execute({
        facilityId: 1,
        personFacilityId: 10,
        classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
        scope: createGlobalScopeContext(),
        roleIds: [ROLE.ADMINISTRATOR],
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
