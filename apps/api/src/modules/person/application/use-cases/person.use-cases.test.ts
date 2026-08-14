import { describe, expect, it } from "bun:test";
import { ResourceNotFoundError } from "../../../../shared/errors";
import type {
  PatchPersonInput,
  PersonRecord,
  PersonRepository,
} from "../interfaces/person.repository.interface";
import {
  GetPersonUseCase,
  ListHealthcareSpecialtiesUseCase,
  PatchPersonUseCase,
} from "./person.use-cases";

function basePerson(overrides?: Partial<PersonRecord>): PersonRecord {
  return {
    id: 1,
    firstName: "Ana",
    lastName: "Silva",
    socialName: null,
    cpf: "52998224725",
    email: "ana@example.com",
    mobilePhone: "11999990000",
    landlinePhone: null,
    birthDate: "1990-05-12",
    favoriteTeam: "Flamengo",
    hobbies: "Corrida",
    languages: "pt-BR",
    imageUrl: null,
    facilityIds: [10, 20],
    hasHealthcareProfile: true,
    ...overrides,
  };
}

function createRepository(options?: {
  person?: PersonRecord | null;
  specialties?: string[];
}): PersonRepository & { store: PersonRecord | null } {
  let store: PersonRecord | null =
    options && "person" in options
      ? (options.person ?? null)
      : basePerson();

  return {
    get store() {
      return store;
    },
    findActiveById: async (personId) =>
      store && store.id === personId ? { ...store, facilityIds: [...store.facilityIds] } : null,
    update: async (personId, input: PatchPersonInput) => {
      if (!store || store.id !== personId) return;
      store = {
        ...store,
        ...Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined)
        ),
      } as PersonRecord;
    },
    listDistinctSpecialtyNames: async () => options?.specialties ?? ["Ortopedia"],
  };
}

describe("GetPersonUseCase", () => {
  it("returns identity DTO with taxId alias and facilityIds", async () => {
    const repository = createRepository();
    const result = await new GetPersonUseCase({
      personRepository: repository,
    }).execute({ personId: 1 });

    expect(result).toEqual({
      id: 1,
      firstName: "Ana",
      lastName: "Silva",
      socialName: null,
      cpf: "52998224725",
      taxId: "52998224725",
      email: "ana@example.com",
      mobilePhone: "11999990000",
      landlinePhone: null,
      birthDate: "1990-05-12",
      favoriteTeam: "Flamengo",
      hobbies: "Corrida",
      languages: "pt-BR",
      imageUrl: null,
      facilityIds: [10, 20],
      hasHealthcareProfile: true,
      registrations: [],
      primaryRegistrationDisplay: null,
      // Defaults to false when no bookmark repository is wired, so the flag
      // can never read "saved" on a caller we know nothing about.
      isBookmarked: false,
    });
  });

  it("throws 404 when person is missing or soft-deleted", async () => {
    const repository = createRepository({ person: null });

    await expect(
      new GetPersonUseCase({ personRepository: repository }).execute({
        personId: 1,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("PatchPersonUseCase", () => {
  it("patches identity fields and returns updated DTO", async () => {
    const repository = createRepository();
    const result = await new PatchPersonUseCase({
      personRepository: repository,
    }).execute({
      personId: 1,
      email: "nova@example.com",
      favoriteTeam: null,
      languages: "pt-BR,en",
    });

    expect(result.email).toBe("nova@example.com");
    expect(result.favoriteTeam).toBeNull();
    expect(result.languages).toBe("pt-BR,en");
    expect(result.taxId).toBe("52998224725");
    expect(repository.store?.email).toBe("nova@example.com");
  });

  it("throws 404 when person is missing or soft-deleted", async () => {
    const repository = createRepository({ person: null });

    await expect(
      new PatchPersonUseCase({ personRepository: repository }).execute({
        personId: 1,
        firstName: "X",
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("ListHealthcareSpecialtiesUseCase", () => {
  it("returns distinct specialty names under data", async () => {
    const repository = createRepository({
      specialties: ["Cardiologia", "Ortopedia"],
    });
    const result = await new ListHealthcareSpecialtiesUseCase({
      personRepository: repository,
    }).execute();

    expect(result).toEqual({ data: ["Cardiologia", "Ortopedia"] });
  });
});
