import { describe, expect, it, mock } from "bun:test";
import {
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import type { PersonProfessionalRegistrationCouncilRepository } from "../interfaces/person-professional-registration-council.repository.interface";
import type {
  PersonProfessionalRegistrationRecord,
  PersonProfessionalRegistrationRepository,
} from "../interfaces/person-professional-registration.repository.interface";
import {
  CreatePersonProfessionalRegistrationUseCase,
  DeactivatePersonProfessionalRegistrationUseCase,
  ListPersonProfessionalRegistrationsUseCase,
  UpdatePersonProfessionalRegistrationUseCase,
} from "./person-professional-registration.use-cases";

function sample(
  overrides: Partial<PersonProfessionalRegistrationRecord> = {}
): PersonProfessionalRegistrationRecord {
  return {
    id: 1,
    personId: 10,
    councilId: 2,
    councilAbbreviation: "CRM",
    councilName: "Conselho Regional de Medicina",
    stateCode: "SP",
    registrationNumber: "123456",
    isPrimary: true,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function repos(opts?: {
  createImpl?: PersonProfessionalRegistrationRepository["create"];
  updateImpl?: PersonProfessionalRegistrationRepository["update"];
  deactivateImpl?: PersonProfessionalRegistrationRepository["deactivate"];
  onPersonSearchChanged?: (personId: number) => Promise<void>;
}) {
  const registrationRepository: PersonProfessionalRegistrationRepository = {
    findActivePersonById: mock(async (id) => (id === 10 ? { id } : null)),
    listByPersonId: mock(async () => [sample()]),
    findByIdForPerson: mock(async () => sample()),
    create:
      opts?.createImpl ??
      mock(async (input) =>
        sample({
          councilId: input.councilId,
          stateCode: input.stateCode,
          registrationNumber: input.registrationNumber,
          isPrimary: input.isPrimary,
        })
      ),
    update:
      opts?.updateImpl ??
      mock(async (input) =>
        sample({
          id: input.registrationId,
          isPrimary: input.isPrimary ?? true,
          isActive: input.isActive ?? true,
        })
      ),
    deactivate:
      opts?.deactivateImpl ??
      mock(async (input) =>
        sample({
          id: input.registrationId,
          isPrimary: false,
          isActive: false,
        })
      ),
  };

  const councilRepository: PersonProfessionalRegistrationCouncilRepository = {
    listActive: mock(async () => [
      {
        id: 2,
        name: "Conselho Regional de Medicina",
        abbreviation: "CRM",
        isActive: true,
      },
    ]),
    findActiveById: mock(async (id) =>
      id === 2
        ? {
            id: 2,
            name: "Conselho Regional de Medicina",
            abbreviation: "CRM",
            isActive: true,
          }
        : null
    ),
  };

  return {
    registrationRepository,
    councilRepository,
    onPersonSearchChanged: opts?.onPersonSearchChanged,
  };
}

describe("ListPersonProfessionalRegistrationsUseCase", () => {
  it("lists active registrations for an existing person", async () => {
    const deps = repos();
    const result = await new ListPersonProfessionalRegistrationsUseCase(
      deps
    ).execute({ personId: 10 });
    expect(result).toHaveLength(1);
    expect(result[0]?.councilAbbreviation).toBe("CRM");
    expect(deps.registrationRepository.listByPersonId).toHaveBeenCalledWith(10, {
      includeInactive: false,
    });
  });

  it("404 when person missing", async () => {
    const deps = repos();
    await expect(
      new ListPersonProfessionalRegistrationsUseCase(deps).execute({
        personId: 999,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("CreatePersonProfessionalRegistrationUseCase", () => {
  it("normalizes UF and creates", async () => {
    const onPersonSearchChanged = mock(async () => {});
    const deps = repos({ onPersonSearchChanged });
    const result = await new CreatePersonProfessionalRegistrationUseCase(
      deps
    ).execute({
      personId: 10,
      councilId: 2,
      stateCode: "sp",
      registrationNumber: " 123456 ",
      isPrimary: true,
    });
    expect(result.stateCode).toBe("SP");
    expect(deps.registrationRepository.create).toHaveBeenCalledWith({
      personId: 10,
      councilId: 2,
      stateCode: "SP",
      registrationNumber: "123456",
      isPrimary: true,
    });
    expect(onPersonSearchChanged).toHaveBeenCalledWith(10);
  });

  it("rejects invalid UF", async () => {
    const onPersonSearchChanged = mock(async () => {});
    const deps = repos({ onPersonSearchChanged });
    await expect(
      new CreatePersonProfessionalRegistrationUseCase(deps).execute({
        personId: 10,
        councilId: 2,
        stateCode: "XX",
        registrationNumber: "1",
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(onPersonSearchChanged).not.toHaveBeenCalled();
  });

  it("maps unique violation to ValidationError", async () => {
    const onPersonSearchChanged = mock(async () => {});
    const deps = repos({
      onPersonSearchChanged,
      createImpl: mock(async () => {
        throw { code: "23505", constraint: "person_professional_registrations_council_state_number_key" };
      }),
    });
    await expect(
      new CreatePersonProfessionalRegistrationUseCase(deps).execute({
        personId: 10,
        councilId: 2,
        stateCode: "SP",
        registrationNumber: "1",
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(onPersonSearchChanged).not.toHaveBeenCalled();
  });
});

describe("UpdatePersonProfessionalRegistrationUseCase", () => {
  it("404 when registration missing", async () => {
    const onPersonSearchChanged = mock(async () => {});
    const deps = repos({
      onPersonSearchChanged,
      updateImpl: mock(async () => null),
    });
    await expect(
      new UpdatePersonProfessionalRegistrationUseCase(deps).execute({
        personId: 10,
        registrationId: 99,
        isPrimary: true,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(onPersonSearchChanged).not.toHaveBeenCalled();
  });

  it("calls search hook after successful update", async () => {
    const onPersonSearchChanged = mock(async () => {});
    const deps = repos({ onPersonSearchChanged });
    await new UpdatePersonProfessionalRegistrationUseCase(deps).execute({
      personId: 10,
      registrationId: 1,
      isPrimary: true,
    });
    expect(onPersonSearchChanged).toHaveBeenCalledWith(10);
  });
});

describe("DeactivatePersonProfessionalRegistrationUseCase", () => {
  it("soft-deactivates and clears primary", async () => {
    const onPersonSearchChanged = mock(async () => {});
    const deps = repos({ onPersonSearchChanged });
    const result = await new DeactivatePersonProfessionalRegistrationUseCase(
      deps
    ).execute({ personId: 10, registrationId: 1 });
    expect(result.isActive).toBe(false);
    expect(result.isPrimary).toBe(false);
    expect(onPersonSearchChanged).toHaveBeenCalledWith(10);
  });
});
