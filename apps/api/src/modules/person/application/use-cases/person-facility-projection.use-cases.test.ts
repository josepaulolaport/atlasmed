import { createGlobalScopeContext } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  PersonFacilityProjectionRecord,
  PersonFacilityProjectionRepository,
} from "../interfaces/person-facility-projection.repository.interface";
import { CLASSIFICATION } from "../interfaces/person-facility-projection.repository.interface";
import {
  PatchPersonFacilityProjectionUseCase,
  ReplacePersonFacilityRolesUseCase,
  UpsertPersonFacilityProjectionUseCase,
} from "./person-facility-projection.use-cases";

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
    classificationCodes: [CLASSIFICATION.ADMINISTRATIVE_CONTACT],
    roleCodes: [],
    endedAt: null,
    ...overrides,
  };
}

const ACTIVE_ROLE_CATALOG = [
  { code: "PRESCRIBER", name: "Prescritor" },
  { code: "BUYER", name: "Comprador" },
  { code: "DECISION_MAKER", name: "Decisor" },
  { code: "PARTNER", name: "Parceiro" },
  { code: "ADMINISTRATOR", name: "Administrador" },
  { code: "BILLER", name: "Faturamento" },
  { code: "SECRETARY", name: "Secretário(a)" },
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
}): PersonFacilityProjectionRepository & {
  adds: Array<{ personFacilityId: number; classificationCode: string }>;
  createdAffiliations: number;
  replacedRoles: Array<{ personFacilityId: number; roleCodes: string[] }>;
} {
  const adds: Array<{ personFacilityId: number; classificationCode: string }> = [];
  const replacedRoles: Array<{ personFacilityId: number; roleCodes: string[] }> = [];
  let createdAffiliations = 0;
  let nextPfId = 100;
  let current = state.row ?? null;

  return {
    adds,
    replacedRoles,
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
    async createAffiliation(input) {
      createdAffiliations += 1;
      const id = nextPfId++;
      current = baseRow({
        personFacilityId: id,
        personId: input.personId,
        facilityId: input.facilityId,
        roleTitle: input.roleTitle ?? null,
        notes: input.notes ?? null,
        classificationCodes: [],
        roleCodes: [],
        hasHealthcareProfile: true,
      });
      return { id };
    },
    async addClassification(input) {
      adds.push(input);
      if (current && current.personFacilityId === input.personFacilityId) {
        if (!current.classificationCodes.includes(input.classificationCode)) {
          current = {
            ...current,
            classificationCodes: [...current.classificationCodes, input.classificationCode],
          };
        }
      }
    },
    async updatePerson() {},
    async updateAffiliation() {},
    async replaceRoleAssignments(input) {
      replacedRoles.push(input);
      if (current && current.personFacilityId === input.personFacilityId) {
        current = { ...current, roleCodes: [...input.roleCodes] };
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
    expect(result.classificationCodes).toContain(CLASSIFICATION.HEALTHCARE_PROFESSIONAL);
    expect(result.roleCodes).toEqual([]);
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
});

describe("PatchPersonFacilityProjectionUseCase", () => {
  it("404s when personFacilityId belongs to another facility", async () => {
    const repo = fakeRepo({
      row: baseRow({
        facilityId: 2,
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

describe("ReplacePersonFacilityRolesUseCase", () => {
  it("replaces role assignments for healthcare affiliation", async () => {
    const repo = fakeRepo({
      row: baseRow({
        classificationCodes: [CLASSIFICATION.HEALTHCARE_PROFESSIONAL],
        roleCodes: ["PARTNER"],
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
      roleCodes: ["PRESCRIBER", "BUYER", "PRESCRIBER"],
    });

    expect(repo.replacedRoles).toEqual([
      { personFacilityId: 10, roleCodes: ["PRESCRIBER", "BUYER"] },
    ]);
    expect(result.roleCodes).toEqual(["PRESCRIBER", "BUYER"]);
  });

  it("allows any seeded catalog role regardless of classification", async () => {
    const repo = fakeRepo({
      row: baseRow({
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
      roleCodes: ["PRESCRIBER", "SECRETARY"],
    });
    expect(result.roleCodes).toEqual(["PRESCRIBER", "SECRETARY"]);
  });

  it("rejects unknown role codes", async () => {
    const repo = fakeRepo({
      row: baseRow({
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
        roleCodes: ["PRESCRIBER", "NOT_A_ROLE"],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.replacedRoles).toEqual([]);
  });

  it("404s when personFacilityId belongs to another facility", async () => {
    const repo = fakeRepo({
      row: baseRow({
        facilityId: 2,
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
        roleCodes: ["BILLER"],
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(repo.replacedRoles).toEqual([]);
  });

  it("404s when affiliation lacks the route classification", async () => {
    const repo = fakeRepo({
      row: baseRow({
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
        roleCodes: ["ADMINISTRATOR"],
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
