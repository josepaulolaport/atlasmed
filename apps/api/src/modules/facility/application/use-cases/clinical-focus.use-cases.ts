import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  FacilityClinicalFocus,
  FacilityRepository,
} from "../interfaces/facility.repository.interface";

interface Dependencies {
  facilityRepository: FacilityRepository;
}

/**
 * Set a clinic's clinical focuses.
 *
 * Applied directly rather than filed as a suggestion. The suggestion queue
 * exists to protect the fields that decide who a clinic *is* — its documento,
 * its endereço, its nome — where a wrong value invalidates a rep's assertion or
 * moves the clinic out of somebody's patch. A focus is a catalogue tag: it is
 * what the rep standing in the clinic was just told, it is drawn from a closed
 * list, and holding it for review only means the CRM does not know it yet.
 */
export class ReplaceFacilityClinicalFocusesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    scope: ScopeContext;
    focuses: { id: number; isPrimary: boolean }[];
  }): Promise<{ clinicalFocuses: FacilityClinicalFocus[] }> {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const facility = await this.deps.facilityRepository.findById(
      input.facilityId,
    );
    if (!facility) {
      throw new ResourceNotFoundError("Facility", input.facilityId);
    }

    // The same focus twice would insert two rows the unique index then rejects,
    // and the caller would see a database error rather than the mistake.
    const seen = new Set<number>();
    for (const focus of input.focuses) {
      if (seen.has(focus.id)) {
        throw new ValidationError([
          { field: "focuses", message: "Focus repetido na seleção" },
        ]);
      }
      seen.add(focus.id);
    }

    if (input.focuses.filter((f) => f.isPrimary).length > 1) {
      throw new ValidationError([
        { field: "focuses", message: "Apenas um foco pode ser o principal" },
      ]);
    }

    // A focus outside the catalogue would otherwise fail on the foreign key,
    // which says nothing about which id was wrong.
    const catalog = await this.deps.facilityRepository.listClinicalFocusCatalog();
    const known = new Set(catalog.map((entry) => entry.id));
    const unknown = input.focuses.filter((f) => !known.has(f.id));
    if (unknown.length > 0) {
      throw new ValidationError([
        {
          field: "focuses",
          message: `Foco clínico desconhecido: ${unknown.map((f) => f.id).join(", ")}`,
        },
      ]);
    }

    const clinicalFocuses =
      await this.deps.facilityRepository.replaceClinicalFocuses({
        facilityId: input.facilityId,
        focuses: input.focuses,
      });

    return { clinicalFocuses };
  }
}
