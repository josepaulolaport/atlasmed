import type { PersonBookmarkRepository } from "../interfaces/person-bookmark.repository.interface";
import { ResourceNotFoundError } from "../../../../shared/errors";
import { formatPrimaryRegistrationDisplay } from "../../infrastructure/repositories/drizzle/load-primary-registration-display-map";
import type {
  PatchPersonInput,
  PersonRecord,
  PersonRepository,
} from "../interfaces/person.repository.interface";
import type { PersonProfessionalRegistrationRepository } from "../interfaces/person-professional-registration.repository.interface";

interface Dependencies {
  personRepository: PersonRepository;
  registrationRepository?: PersonProfessionalRegistrationRepository;
  /**
   * Optional: when wired, the detail response carries `isBookmarked`, so the
   * icon is right on first paint instead of flipping after a second request.
   */
  personBookmarkRepository?: PersonBookmarkRepository;
}

function serializeRegistrationSummary(
  row: Awaited<
    ReturnType<PersonProfessionalRegistrationRepository["listByPersonId"]>
  >[number]
) {
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

/** Mobile-compatible identity DTO (`ProfessionalDTO`-ish). */
async function serializePerson(
  person: PersonRecord,
  registrationRepository?: PersonProfessionalRegistrationRepository
) {
  const registrations = registrationRepository
    ? (
        await registrationRepository.listByPersonId(person.id, {
          includeInactive: false,
        })
      ).map(serializeRegistrationSummary)
    : [];

  const primary = registrations.find((row) => row.isPrimary) ?? registrations[0];
  const primaryRegistrationDisplay = primary
    ? formatPrimaryRegistrationDisplay({
        councilAbbreviation: primary.councilAbbreviation,
        stateCode: primary.stateCode,
        registrationNumber: primary.registrationNumber,
      })
    : null;

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    socialName: person.socialName,
    cpf: person.cpf,
    /**
     * COMPAT(remove): alias for mobile `ProfessionalDTO.taxId`.
     * Drop when mobile reads `cpf` only / renames the DTO field.
     */
    taxId: person.cpf,
    email: person.email,
    mobilePhone: person.mobilePhone,
    landlinePhone: person.landlinePhone,
    birthDate: person.birthDate,
    favoriteTeam: person.favoriteTeam,
    hobbies: person.hobbies,
    languages: person.languages,
    imageUrl: person.imageUrl,
    facilityIds: person.facilityIds,
    hasHealthcareProfile: person.hasHealthcareProfile,
    registrations,
    primaryRegistrationDisplay,
  };
}

export class GetPersonUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number; userId?: number }) {
    const person = await this.deps.personRepository.findActiveById(
      input.personId
    );
    if (!person) {
      throw new ResourceNotFoundError("Person", input.personId);
    }

    const bookmarkRepository = this.deps.personBookmarkRepository;
    const isBookmarked =
      bookmarkRepository && input.userId
        ? (
            await bookmarkRepository.findBookmarkedIds({
              userId: input.userId,
              personIds: [person.id],
            })
          ).length > 0
        : false;

    return {
      ...(await serializePerson(person, this.deps.registrationRepository)),
      isBookmarked,
    };
  }
}

export class PatchPersonUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number } & PatchPersonInput) {
    const existing = await this.deps.personRepository.findActiveById(
      input.personId
    );
    if (!existing) {
      throw new ResourceNotFoundError("Person", input.personId);
    }

    const { personId, ...patch } = input;
    await this.deps.personRepository.update(personId, patch);

    const updated = await this.deps.personRepository.findActiveById(personId);
    if (!updated) {
      throw new ResourceNotFoundError("Person", personId);
    }
    return serializePerson(updated, this.deps.registrationRepository);
  }
}

export class ListHealthcareSpecialtiesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    const specialties =
      await this.deps.personRepository.listDistinctSpecialtyNames();
    return { data: specialties };
  }
}
