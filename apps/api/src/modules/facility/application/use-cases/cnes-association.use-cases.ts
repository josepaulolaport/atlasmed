import { assertResourceInScope, type ScopeContext } from "@atlasmed/access";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { DrizzleCnesImportRepository } from "../../infrastructure/repositories/drizzle/drizzle-cnes-import.repository";
import { resolveOccupations } from "./cnes-import.use-cases";

/**
 * Linking someone we already hold to a clinic CNES places them at (spec 0012 §5).
 *
 * The middle tier of the suggestion list: we know the person, CNES knows they
 * work here, and nobody has recorded the second fact on our side. Importing
 * them is wrong — that would try to create a person who exists — and the
 * generic projection upsert was wrong for a different reason: it knows nothing
 * about the registry, so it wrote the affiliation and silently dropped the CBO
 * that made the suggestion worth acting on.
 *
 * Identity is resolved here rather than accepted from the client, for the same
 * reason the import refuses a registration in its body: the SUS id is what the
 * suggestion was built from, and letting the client name the person instead
 * would let a mis-sent id attach one doctor's occupation to another.
 */

export interface AssociateCnesProfessionalInput {
  facilityId: number;
  professionalCnesId: string;
  scope: ScopeContext;
  /**
   * What the rep confirmed. Omitted means "what CNES records"; an empty array
   * means they cleared it, and the affiliation is still written.
   */
  occupationIds?: number[];
}

export interface AssociateCnesProfessionalResult {
  personId: number;
  personFacilityId: number;
  /** False when they were already linked here and this call changed nothing. */
  created: boolean;
  /** What CNES records them doing at this clinic. */
  occupations: string[];
}

export class AssociateCnesProfessionalUseCase {
  constructor(private readonly repository = new DrizzleCnesImportRepository()) {}

  async execute(
    input: AssociateCnesProfessionalInput
  ): Promise<AssociateCnesProfessionalResult> {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const professional = await this.repository.findProfessional({
      professionalCnesId: input.professionalCnesId,
      facilityId: input.facilityId,
    });
    if (!professional) {
      throw new ResourceNotFoundError(
        "registry_professional",
        input.professionalCnesId
      );
    }

    // Same wall the import stands behind: without it this is a general "link
    // any registry professional anywhere" tool, and the facility scope check
    // above would guard nothing.
    if (!professional.atThisFacility) {
      throw new ValidationError([
        {
          field: "professionalCnesId",
          message: "CNES does not place this professional at this facility",
        },
      ]);
    }

    /*
     * Three routes to the same person, in the order the evidence is trusted:
     * the bridge a load or an earlier association set, the SUS id an old
     * backfill stamped on a profile, and finally the council registration —
     * which is how someone the import refused with 409 gets associated instead
     * of being unreachable.
     */
    const personId =
      professional.atlasmedId ??
      professional.profilePersonId ??
      professional.registrations.find((r) => r.heldByPersonId != null)
        ?.heldByPersonId ??
      null;

    if (personId == null) {
      throw new ValidationError([
        {
          field: "professionalCnesId",
          message:
            "we do not hold this professional; import them rather than associating",
        },
      ]);
    }

    const { personFacilityId, affiliationCreated } =
      await this.repository.associateAtFacility({
        professionalCnesId: professional.cnesId,
        personId,
        facilityId: input.facilityId,
        occupationIds: resolveOccupations(input.occupationIds, professional),
      });

    return {
      personId,
      personFacilityId,
      created: affiliationCreated,
      occupations: professional.occupations,
    };
  }
}
