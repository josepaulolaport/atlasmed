import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import type {
  FacilityCommercialStatus,
  FacilityListScopeFilter,
  FacilityPurchaseStatus,
  FacilityVerticalProfileRecord,
} from "../interfaces/facility.repository.interface";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";

export function buildFacilityListScope(input: {
  scope: ScopeContext;
  role: string;
  verticalId?: string;
}): FacilityListScopeFilter {
  const assignedVerticalIds = input.scope.assignedVerticalIds ?? [];
  const resolvedVerticalIds = resolveVerticalIds({
    role: input.role,
    assignedVerticalIds,
    queryVerticalId: input.verticalId,
  });

  if (input.scope.isGlobal && input.role === Role.ADMIN) {
    return {
      isGlobal: true,
      verticalIds: resolvedVerticalIds,
      restrictToVerticalProfiles: Boolean(input.verticalId),
    };
  }

  return {
    isGlobal: false,
    facilityIds: input.scope.facilityIds,
    verticalIds: resolvedVerticalIds,
    restrictToVerticalProfiles: true,
  };
}

export function applyVerticalProfileContext(
  facility: {
    commercialStatus: FacilityCommercialStatus | null;
    purchaseStatus: FacilityPurchaseStatus | null;
    verticalProfiles?: FacilityVerticalProfileRecord[];
  },
  verticalIds?: string[],
): {
  commercialStatus?: FacilityCommercialStatus;
  verticalProfiles?: FacilityVerticalProfileRecord[];
} {
  const profiles = facility.verticalProfiles ?? [];
  const matching =
    verticalIds && verticalIds.length > 0
      ? profiles.filter((p) => verticalIds.includes(p.verticalId))
      : profiles;

  if (matching.length === 1) {
    return {
      commercialStatus: matching[0]!.commercialStatus ?? undefined,
    };
  }

  if (matching.length > 1) {
    return { verticalProfiles: matching };
  }

  return {
    commercialStatus: facility.commercialStatus ?? undefined,
  };
}
