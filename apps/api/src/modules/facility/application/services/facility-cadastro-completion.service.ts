import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { CadastroSubmissionRepository } from "../interfaces/cadastro-submission.repository.interface";
import { ResourceNotFoundError } from "../../../../shared/errors";
import { resolveFacilityLegalDocumentType } from "../utils/facility-tax-id.utils";

interface Dependencies {
  facilityRepository: FacilityRepository;
  conformityRepository: ConformityRepository;
  cadastroRepository?: CadastroSubmissionRepository;
}

export function isBillingEmailComplete(billingEmail: string | null | undefined): boolean {
  return typeof billingEmail === "string" && billingEmail.trim().length > 0;
}

/**
 * When every tax-type-applicable file doc is APPROVED/VALIDATED and billingEmail
 * is set, flip the profile to REGISTERED. Otherwise, if it had been REGISTERED,
 * commercialStatus=SUSPENDED when it was REGISTERED (operante).
 */
export class FacilityCadastroCompletionService {
  constructor(private readonly deps: Dependencies) {}

  async evaluateAndApply(
    facilityId: number,
    verticalId: number,
  ): Promise<{
    complete: boolean;
    commercialStatus: "REGISTERED" | "SUSPENDED" | null;
  }> {
    const facility = await this.deps.facilityRepository.findById(facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", facilityId);
    }

    await this.deps.facilityRepository.ensureVerticalProfile({
      facilityId,
      verticalId,
    });

    const profiles = await this.deps.facilityRepository.findVerticalProfilesByFacilityIds(
      [facilityId],
      [verticalId],
    );
    const profile = profiles.get(facilityId)?.[0];
    const currentCommercialStatus = profile?.commercialStatus ?? null;

    const requirements = await this.deps.conformityRepository.findActiveRequirements({
      legalDocumentType: resolveFacilityLegalDocumentType(facility),
    });

    let docsComplete = false;
    if (this.deps.cadastroRepository) {
      const approvedFlags = await Promise.all(
        requirements.map(async (requirement) => {
          const history =
            await this.deps.cadastroRepository!.listDocumentsForFacilityRequirement({
              facilityId,
              requirementId: requirement.id,
              excludeDraft: true,
            });
          return history.some((h) => h.document.status === "APPROVED");
        })
      );
      docsComplete =
        requirements.length > 0 && approvedFlags.every((ok) => ok);
    }

    if (!docsComplete) {
      const records = await this.deps.conformityRepository.findRecordsByFacility(facilityId);
      const recordByRequirement = new Map(records.map((r) => [r.requirementId, r]));
      docsComplete =
        requirements.length > 0 &&
        requirements.every((requirement) => {
          const record = recordByRequirement.get(requirement.id);
          return record?.status === "VALIDATED";
        });
    }

    const emailComplete = isBillingEmailComplete(facility.billingEmail);
    const complete = docsComplete && emailComplete;

    // Cadastro completion is recorded once, on the profile (spec 0010 §1.6).
    // This used to write facilities.conformity_status as well — a second,
    // facility-wide verdict for a per-vertical fact. A clinic complete in one
    // linha and untouched in another read COMPLETE for both. That column is
    // gone; the profile is the only record.
    if (complete) {
      await this.deps.facilityRepository.updateVerticalProfileCommercialStatus({
        facilityId,
        verticalId,
        commercialStatus: "REGISTERED",
      });
      return {
        complete: true,
        commercialStatus: "REGISTERED",
      };
    }

    // Regression: only a profile that had reached REGISTERED can be SUSPENDED.
    // An UNREGISTERED profile stays UNREGISTERED — never completed is not the
    // same as stopped being complete.
    if (currentCommercialStatus === "REGISTERED") {
      await this.deps.facilityRepository.updateVerticalProfileCommercialStatus({
        facilityId,
        verticalId,
        commercialStatus: "SUSPENDED",
      });
    }

    return {
      complete: false,
      commercialStatus:
        currentCommercialStatus === "REGISTERED" ||
        currentCommercialStatus === "SUSPENDED"
          ? "SUSPENDED"
          : null,
    };
  }
}
