import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { PersonRepository } from "../interfaces/person.repository.interface";
import type { HealthcareSpecialtyCatalogRepository } from "./list-healthcare-specialty-catalog.use-case";

type Dependencies = {
  personRepository: PersonRepository;
  specialtyCatalogRepository: HealthcareSpecialtyCatalogRepository;
};

/**
 * Set a doctor's specialties.
 *
 * Applied directly rather than filed as a suggestion, on the same reasoning as
 * a clinic's clinical focuses: this is a catalogue tag learned in the field,
 * not one of the identity fields whose correctness a rep's work depends on.
 * Until now the only writer was the CNES importer, so a specialty the registry
 * did not carry could not be recorded at all.
 */
export class ReplacePersonSpecialtiesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    personId: number;
    specialties: { id: number; isPrimary: boolean }[];
  }) {
    const person = await this.deps.personRepository.findActiveById(
      input.personId,
    );
    if (!person) {
      throw new ResourceNotFoundError("Person", input.personId);
    }

    const seen = new Set<number>();
    for (const specialty of input.specialties) {
      if (seen.has(specialty.id)) {
        throw new ValidationError([
          { field: "specialties", message: "Especialidade repetida na seleção" },
        ]);
      }
      seen.add(specialty.id);
    }

    if (input.specialties.filter((s) => s.isPrimary).length > 1) {
      throw new ValidationError([
        {
          field: "specialties",
          message: "Apenas uma especialidade pode ser a principal",
        },
      ]);
    }

    // Checked against the catalogue so an unknown id is reported as such rather
    // than surfacing as a foreign key violation naming no particular entry.
    const catalog = await this.deps.specialtyCatalogRepository.listActive();
    const known = new Set(catalog.map((entry) => entry.id));
    const unknown = input.specialties.filter((s) => !known.has(s.id));
    if (unknown.length > 0) {
      throw new ValidationError([
        {
          field: "specialties",
          message: `Especialidade desconhecida: ${unknown.map((s) => s.id).join(", ")}`,
        },
      ]);
    }

    return {
      specialties: await this.deps.personRepository.replaceSpecialties({
        personId: input.personId,
        specialties: input.specialties,
      }),
    };
  }
}
