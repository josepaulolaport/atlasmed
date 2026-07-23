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
 * is set, flip conformityStatus=COMPLETE and commercialStatus=ACTIVE.
 * Otherwise force conformityStatus=INCOMPLETE and commercialStatus=SUSPENDED
 * when it was ACTIVE (rejection / missing docs must revoke commercial activation).
 */
export class FacilityCadastroCompletionService {
  constructor(private readonly deps: Dependencies) {}

  async evaluateAndApply(facilityId: string): Promise<{
    complete: boolean;
    conformityStatus: "INCOMPLETE" | "COMPLETE";
    commercialStatus: "ACTIVE" | "SUSPENDED" | null;
  }> {
    const facility = await this.deps.facilityRepository.findById(facilityId);
    if (!facility) {
      throw new ResourceNotFoundError("Facility", facilityId);
    }

    const requirements = await this.deps.conformityRepository.findActiveRequirements({
      taxIdType: resolveFacilityTaxIdType(facility),
    });

    let docsComplete = false;
    if (this.deps.cadastroRepository) {
      // Per-document submissions live in separate packages — require an
      // APPROVED document for each catalog requirement across history.
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
      commercialStatus?: "SUSPENDED";
    } = {};
    if (facility.conformityStatus !== "INCOMPLETE") {
      patch.conformityStatus = "INCOMPLETE";
    }
    if (facility.commercialStatus === "ACTIVE") {
      patch.commercialStatus = "SUSPENDED";
    }
    if (Object.keys(patch).length > 0) {
      await this.deps.facilityRepository.update(facilityId, patch);
    }

    return {
      complete: false,
      conformityStatus: "INCOMPLETE",
      commercialStatus:
        facility.commercialStatus === "ACTIVE" ||
        facility.commercialStatus === "SUSPENDED"
          ? "SUSPENDED"
          : null,
    };
  }
}
