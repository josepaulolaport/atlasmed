import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import type { FacilityVerticalAccessRepository } from "../interfaces/facility-vertical-access.repository.interface";

export const PAYER_SHARES_VERTICAL_CODE = "ORTOPEDIA";

/**
 * Fontes Pagadoras only when facility ∩ user includes Ortopedia.
 * ADMIN/OPS follow the same assignedVerticalIds rule.
 */
export async function assertPayerSharesOrtopediaAccess(input: {
  facilityId: string;
  scope: ScopeContext;
  facilityVerticalAccess: FacilityVerticalAccessRepository;
}): Promise<void> {
  const ortopediaId = await input.facilityVerticalAccess.findVerticalIdByCode(
    PAYER_SHARES_VERTICAL_CODE
  );
  if (!ortopediaId) {
    throw new ForbiddenError();
  }

  const assigned = input.scope.assignedVerticalIds ?? [];
  if (!assigned.includes(ortopediaId)) {
    throw new ForbiddenError();
  }

  const facilityHasOrtopedia =
    await input.facilityVerticalAccess.hasActiveVerticalProfile(
      input.facilityId,
      ortopediaId
    );
  if (!facilityHasOrtopedia) {
    throw new ForbiddenError();
  }
}
