import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { CadastroSubmissionRepository } from "../interfaces/cadastro-submission.repository.interface";
import { ResourceNotFoundError } from "../../../../shared/errors";
import { resolveFacilityTaxIdType } from "../utils/facility-tax-id.utils";

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
 * is set, flip conformityStatus=COMPLETE and commercialStatus=ACTIVE on the
 * facility vertical profile. Otherwise force conformityStatus=INCOMPLETE and
 * commercialStatus=SUSPENDED when it was ACTIVE.
 */
export class FacilityCadastroCompletionService {
  constructor(private readonly deps: Dependencies) {}

  async evaluateAndApply(
    facilityId: string,
    verticalId: string,
  ): Promise<{
    complete: boolean;
    conformityStatus: "INCOMPLETE" | "COMPLETE";
    commercialStatus: "ACTIVE" | "SUSPENDED" | null;
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
      taxIdType: resolveFacilityTaxIdType(facility),
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

    if (complete) {
      await this.deps.facilityRepository.update(facilityId, {
        conformityStatus: "COMPLETE",
      });
      await this.deps.facilityRepository.updateVerticalProfileCommercialStatus({
        facilityId,
        verticalId,
        commercialStatus: "ACTIVE",
      });
      return {
        complete: true,
        conformityStatus: "COMPLETE",
        commercialStatus: "ACTIVE",
      };
    }

    const patch: {
      conformityStatus?: "INCOMPLETE";
    } = {};
    if (facility.conformityStatus !== "INCOMPLETE") {
      patch.conformityStatus = "INCOMPLETE";
    }
    if (Object.keys(patch).length > 0) {
      await this.deps.facilityRepository.update(facilityId, patch);
    }

    if (currentCommercialStatus === "ACTIVE") {
      await this.deps.facilityRepository.updateVerticalProfileCommercialStatus({
        facilityId,
        verticalId,
        commercialStatus: "SUSPENDED",
      });
    }

    return {
      complete: false,
      conformityStatus: "INCOMPLETE",
      commercialStatus:
        currentCommercialStatus === "ACTIVE" ||
        currentCommercialStatus === "SUSPENDED"
          ? "SUSPENDED"
          : null,
    };
  }
}
