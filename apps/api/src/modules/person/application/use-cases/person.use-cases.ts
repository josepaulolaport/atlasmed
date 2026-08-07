import { ResourceNotFoundError } from "../../../../shared/errors";
import type {
  PatchPersonInput,
  PersonRecord,
  PersonRepository,
} from "../interfaces/person.repository.interface";

interface Dependencies {
  personRepository: PersonRepository;
}

/** Mobile-compatible identity DTO (`ProfessionalDTO`-ish). */
function serializePerson(person: PersonRecord) {
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
  };
}

export class GetPersonUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number }) {
    const person = await this.deps.personRepository.findActiveById(
      input.personId
    );
    if (!person) {
      throw new ResourceNotFoundError("Person", input.personId);
    }
    return serializePerson(person);
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
    return serializePerson(updated);
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
