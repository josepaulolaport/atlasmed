import { createGlobalScopeContext } from "@atlasmed/access";
import { describe, expect, it } from "bun:test";
import { ResourceNotFoundError } from "../../../../shared/errors";
import type {
  PersonFacilityProjectionRecord,
  PersonFacilityProjectionRepository,
} from "../interfaces/person-facility-projection.repository.interface";
import { CLASSIFICATION } from "../interfaces/person-facility-projection.repository.interface";
import {
  PatchPersonFacilityProjectionUseCase,
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
    endedAt: null,
    ...overrides,
  };
}

function fakeRepo(state: {
  affiliation?: { id: number; facilityId: number; personId: number } | null;
  person?: { id: number; deletedAt: Date | null } | null;
  row?: PersonFacilityProjectionRecord | null;
}): PersonFacilityProjectionRepository & {
  adds: Array<{ personFacilityId: number; classificationCode: string }>;
  createdAffiliations: number;
} {
  const adds: Array<{ personFacilityId: number; classificationCode: string }> = [];
  let createdAffiliations = 0;
  let nextPfId = 100;
  let current = state.row ?? null;

  return {
    adds,
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
