import {
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import { isPostgresUniqueViolation } from "../../../../shared/utils/postgres-unique-violation";
import type { PersonProfessionalRegistrationCouncilRepository } from "../interfaces/person-professional-registration-council.repository.interface";
import type {
  PersonProfessionalRegistrationRecord,
  PersonProfessionalRegistrationRepository,
} from "../interfaces/person-professional-registration.repository.interface";

const BRAZIL_UF = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

type Dependencies = {
  registrationRepository: PersonProfessionalRegistrationRepository;
  councilRepository: PersonProfessionalRegistrationCouncilRepository;
  onPersonSearchChanged?: (personId: number) => Promise<void>;
};

function serializeRegistration(row: PersonProfessionalRegistrationRecord) {
  return {
    id: row.id,
    personId: row.personId,
    councilId: row.councilId,
    councilAbbreviation: row.councilAbbreviation,
    councilName: row.councilName,
    stateCode: row.stateCode,
    registrationNumber: row.registrationNumber,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeStateCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizeRegistrationNumber(raw: string): string {
  return raw.trim();
}

function assertValidStateCode(stateCode: string) {
  if (!BRAZIL_UF.has(stateCode)) {
    throw new ValidationError([
      { field: "stateCode", message: "stateCode must be a valid Brazilian UF" },
    ]);
  }
}

function assertValidRegistrationNumber(registrationNumber: string) {
  if (registrationNumber.length < 1 || registrationNumber.length > 64) {
    throw new ValidationError([
      {
        field: "registrationNumber",
        message: "registrationNumber must be 1–64 characters",
      },
    ]);
  }
}

function mapUniqueViolation(error: unknown): never {
  if (!isPostgresUniqueViolation(error)) {
    throw error;
  }

  const constraint =
    typeof error === "object" &&
    error !== null &&
    "constraint" in error &&
    typeof (error as { constraint?: unknown }).constraint === "string"
      ? (error as { constraint: string }).constraint
      : null;

  if (
    constraint === "person_professional_registrations_primary_uidx" ||
    constraint?.includes("primary")
  ) {
    throw new ValidationError([
      {
        field: "isPrimary",
        message: "Person already has a primary registration",
      },
    ]);
  }

  throw new ValidationError([
    {
      field: "registrationNumber",
      message:
        "This council/UF/number combination is already registered to another person",
    },
  ]);
}

async function assertActivePerson(
  repository: PersonProfessionalRegistrationRepository,
  personId: number
) {
  const person = await repository.findActivePersonById(personId);
  if (!person) {
    throw new ResourceNotFoundError("Person", personId);
  }
}

async function assertActiveCouncil(
  councilRepository: PersonProfessionalRegistrationCouncilRepository,
  councilId: number
) {
  const council = await councilRepository.findActiveById(councilId);
  if (!council) {
    throw new ResourceNotFoundError(
      "PersonProfessionalRegistrationCouncil",
      councilId
    );
  }
  return council;
}

export class ListPersonProfessionalRegistrationsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number; includeInactive?: boolean }) {
    await assertActivePerson(this.deps.registrationRepository, input.personId);
    const rows = await this.deps.registrationRepository.listByPersonId(
      input.personId,
      { includeInactive: input.includeInactive === true }
    );
    return rows.map(serializeRegistration);
  }
}

export class CreatePersonProfessionalRegistrationUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    personId: number;
    councilId: number;
    stateCode: string;
    registrationNumber: string;
    isPrimary?: boolean;
  }) {
    await assertActivePerson(this.deps.registrationRepository, input.personId);
    await assertActiveCouncil(this.deps.councilRepository, input.councilId);

    const stateCode = normalizeStateCode(input.stateCode);
    assertValidStateCode(stateCode);
    const registrationNumber = normalizeRegistrationNumber(
      input.registrationNumber
    );
    assertValidRegistrationNumber(registrationNumber);

    try {
      // Healthcare profile ensured inside create() TX (onConflictDoNothing).
      const created = await this.deps.registrationRepository.create({
        personId: input.personId,
        councilId: input.councilId,
        stateCode,
        registrationNumber,
        isPrimary: input.isPrimary === true,
      });
      await this.deps.onPersonSearchChanged?.(input.personId);
      return serializeRegistration(created);
    } catch (error) {
      mapUniqueViolation(error);
    }
  }
}

export class UpdatePersonProfessionalRegistrationUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    personId: number;
    registrationId: number;
    councilId?: number;
    stateCode?: string;
    registrationNumber?: string;
    isPrimary?: boolean;
    isActive?: boolean;
  }) {
    await assertActivePerson(this.deps.registrationRepository, input.personId);

    if (input.councilId !== undefined) {
      await assertActiveCouncil(this.deps.councilRepository, input.councilId);
    }

    const stateCode =
      input.stateCode !== undefined
        ? normalizeStateCode(input.stateCode)
        : undefined;
    if (stateCode !== undefined) assertValidStateCode(stateCode);

    const registrationNumber =
      input.registrationNumber !== undefined
        ? normalizeRegistrationNumber(input.registrationNumber)
        : undefined;
    if (registrationNumber !== undefined) {
      assertValidRegistrationNumber(registrationNumber);
    }

    try {
      const updated = await this.deps.registrationRepository.update({
        personId: input.personId,
        registrationId: input.registrationId,
        councilId: input.councilId,
        stateCode,
        registrationNumber,
        isPrimary: input.isPrimary,
        isActive: input.isActive,
      });
      if (!updated) {
        throw new ResourceNotFoundError(
          "PersonProfessionalRegistration",
          input.registrationId
        );
      }
      await this.deps.onPersonSearchChanged?.(input.personId);
      return serializeRegistration(updated);
    } catch (error) {
      if (error instanceof ResourceNotFoundError) throw error;
      mapUniqueViolation(error);
    }
  }
}

export class DeactivatePersonProfessionalRegistrationUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number; registrationId: number }) {
    await assertActivePerson(this.deps.registrationRepository, input.personId);

    const deactivated = await this.deps.registrationRepository.deactivate({
      personId: input.personId,
      registrationId: input.registrationId,
    });
    if (!deactivated) {
      throw new ResourceNotFoundError(
        "PersonProfessionalRegistration",
        input.registrationId
      );
    }
    await this.deps.onPersonSearchChanged?.(input.personId);
    return serializeRegistration(deactivated);
  }
}
