import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import type {
  FacilityListScopeFilter,
  FacilityVerticalProfileRecord,
} from "../interfaces/facility.repository.interface";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";

export function buildFacilityListScope(input: {
  scope: ScopeContext;
  role: string;
  verticalId?: number;
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

/**
 * Which vertical profiles to expose on the facility DTO.
 * Commercial / purchase / recurrence live only on each profile — never
 * projected to facility top-level.
 */
export function applyVerticalProfileContext(
  facility: {
    verticalProfiles?: FacilityVerticalProfileRecord[];
  },
  verticalIds?: number[],
  options?: {
    /**
     * Profiles to expose on the DTO (e.g. all user-assigned verticals).
     * Defaults to [verticalIds]. Detail uses this so Linha switcher still
     * sees Orto+Derm when list/filter is scoped to one Linha.
     */
    exposeProfileVerticalIds?: number[];
  },
): {
  verticalProfiles?: FacilityVerticalProfileRecord[];
  hasProfileContext: boolean;
} {
  const profiles = facility.verticalProfiles ?? [];
  const exposeIds = options?.exposeProfileVerticalIds ?? verticalIds;
  const exposed =
    exposeIds && exposeIds.length > 0
      ? profiles.filter((p) => exposeIds.includes(p.verticalId))
      : profiles;

  if (exposed.length > 0) {
    return { verticalProfiles: exposed, hasProfileContext: true };
  }

  if (profiles.length > 0 || (verticalIds && verticalIds.length > 0)) {
    return { hasProfileContext: true };
  }

  return { hasProfileContext: false };
}
