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
  // Header already applied onto scope.activeVerticalId in auth plugin.
  const filterVerticalId =
    input.verticalId ?? input.scope.activeVerticalId ?? undefined;
  const resolvedVerticalIds = resolveVerticalIds({
    role: input.role,
    assignedVerticalIds,
    queryVerticalId: filterVerticalId,
  });

  if (input.scope.isGlobal && input.role === Role.ADMIN) {
    return {
      isGlobal: true,
      verticalIds: resolvedVerticalIds,
      // Always profile-bound when verticals resolve — ADMIN UVA (or header
      // narrow) must not leak facilities outside those verticals.
      restrictToVerticalProfiles: resolvedVerticalIds.length > 0,
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
  purchaseStatus?: FacilityPurchaseStatus;
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
      purchaseStatus: matching[0]!.purchaseStatus ?? undefined,
      // Always expose profile identity so clients can badge verticals.
      verticalProfiles: matching,
    };
  }

  if (matching.length > 1) {
    // Never mix conflicting commercial fields across verticals. When every
    // matching profile agrees, expose the shared status so list chips work
    // under "Todas" (e.g. Orto+Derm both UNREGISTERED).
    const commercialStatuses = new Set(
      matching
        .map((profile) => profile.commercialStatus)
        .filter((status): status is FacilityCommercialStatus => status != null),
    );
    const purchaseStatuses = new Set(
      matching
        .map((profile) => profile.purchaseStatus)
        .filter((status): status is FacilityPurchaseStatus => status != null),
    );
    return {
      verticalProfiles: matching,
      ...(commercialStatuses.size === 1
        ? { commercialStatus: [...commercialStatuses][0] }
        : {}),
      ...(purchaseStatuses.size === 1
        ? { purchaseStatus: [...purchaseStatuses][0] }
        : {}),
    };
  }

  // No matching profile in resolved verticals — do not leak legacy global commercial.
  if (profiles.length > 0 || (verticalIds && verticalIds.length > 0)) {
    return {};
  }

  return {
    commercialStatus: facility.commercialStatus ?? undefined,
    purchaseStatus: facility.purchaseStatus ?? undefined,
  };
}
