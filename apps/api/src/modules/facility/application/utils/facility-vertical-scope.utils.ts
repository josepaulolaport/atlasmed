import type { ScopeContext } from "@atlasmed/access";
import { Role } from "@atlasmed/access";
import type {
  FacilityCommercialStatus,
  FacilityListScopeFilter,
  FacilityPurchaseStatus,
  FacilityVerticalProfilePurchaseRecurrence,
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

function profileRecurrence(
  profile: FacilityVerticalProfileRecord,
): FacilityVerticalProfilePurchaseRecurrence | undefined {
  return profile.purchaseRecurrence;
}

function recurrencesAgree(
  a: FacilityVerticalProfilePurchaseRecurrence,
  b: FacilityVerticalProfilePurchaseRecurrence,
): boolean {
  return a.purchaseFunnelStage === b.purchaseFunnelStage
    && a.purchaseIntervalDays === b.purchaseIntervalDays
    && a.purchaseIntervalSource === b.purchaseIntervalSource
    && a.lastValidPurchaseDate === b.lastValidPurchaseDate
    && a.manualPurchaseProfile === b.manualPurchaseProfile
    && a.manualPurchaseIntervalDays === b.manualPurchaseIntervalDays;
}

export function applyVerticalProfileContext(
  facility: {
    commercialStatus: FacilityCommercialStatus | null;
    purchaseStatus: FacilityPurchaseStatus | null;
    verticalProfiles?: FacilityVerticalProfileRecord[];
    /** Legacy facility-global funnel — only used when no profiles. */
    observedPurchaseIntervalDays?: number | null;
    purchaseIntervalDays?: number;
    purchaseIntervalSource?: FacilityVerticalProfilePurchaseRecurrence["purchaseIntervalSource"];
    manualPurchaseProfile?: FacilityVerticalProfilePurchaseRecurrence["manualPurchaseProfile"];
    manualPurchaseIntervalDays?: number | null;
    lastValidPurchaseDate?: string | null;
    purchaseRecurrenceSampleSize?: number;
    purchaseFunnelStage?: FacilityVerticalProfilePurchaseRecurrence["purchaseFunnelStage"];
    nextPurchaseFunnelTransitionDate?: string | null;
  },
  verticalIds?: string[],
  options?: {
    /**
     * Profiles to expose on the DTO (e.g. all user-assigned verticals).
     * Defaults to [verticalIds]. Detail uses this so Linha switcher still
     * sees Orto+Derm when commercial/funnel are scoped to one Linha.
     */
    exposeProfileVerticalIds?: string[];
  },
): {
  commercialStatus?: FacilityCommercialStatus;
  purchaseStatus?: FacilityPurchaseStatus;
  verticalProfiles?: FacilityVerticalProfileRecord[];
  /** Top-level purchaseRecurrence when single profile or multi agree. */
  purchaseRecurrence?: FacilityVerticalProfilePurchaseRecurrence;
  /** True when profiles exist in scope — omit facility rollup fallback. */
  hasProfileContext: boolean;
} {
  const profiles = facility.verticalProfiles ?? [];
  const matching =
    verticalIds && verticalIds.length > 0
      ? profiles.filter((p) => verticalIds.includes(p.verticalId))
      : profiles;
  const exposeIds = options?.exposeProfileVerticalIds ?? verticalIds;
  const exposed =
    exposeIds && exposeIds.length > 0
      ? profiles.filter((p) => exposeIds.includes(p.verticalId))
      : profiles;

  if (matching.length === 1) {
    const profile = matching[0]!;
    return {
      commercialStatus: profile.commercialStatus ?? undefined,
      purchaseStatus: profile.purchaseStatus ?? undefined,
      verticalProfiles: exposed.length > 0 ? exposed : matching,
      purchaseRecurrence: profileRecurrence(profile),
      hasProfileContext: true,
    };
  }

  if (matching.length > 1) {
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
    const recurrences = matching
      .map(profileRecurrence)
      .filter((r): r is FacilityVerticalProfilePurchaseRecurrence => r != null);
    const agree =
      recurrences.length === matching.length
      && recurrences.every((r) => recurrencesAgree(recurrences[0]!, r));

    return {
      verticalProfiles: exposed.length > 0 ? exposed : matching,
      hasProfileContext: true,
      ...(commercialStatuses.size === 1
        ? { commercialStatus: [...commercialStatuses][0] }
        : {}),
      ...(purchaseStatuses.size === 1
        ? { purchaseStatus: [...purchaseStatuses][0] }
        : {}),
      ...(agree ? { purchaseRecurrence: recurrences[0] } : {}),
    };
  }

  // No matching profile in resolved verticals — do not leak legacy global commercial/funnel.
  // Still expose other assigned profiles when present (detail Linha switcher).
  if (profiles.length > 0 || (verticalIds && verticalIds.length > 0)) {
    return {
      hasProfileContext: true,
      ...(exposed.length > 0 ? { verticalProfiles: exposed } : {}),
    };
  }

  // No profiles at all — legacy facility columns.
  const legacyRecurrence =
    facility.purchaseFunnelStage != null && facility.purchaseIntervalDays != null
      ? {
          observedPurchaseIntervalDays: facility.observedPurchaseIntervalDays ?? null,
          purchaseIntervalDays: facility.purchaseIntervalDays,
          purchaseIntervalSource: facility.purchaseIntervalSource ?? "DEFAULT",
          manualPurchaseProfile: facility.manualPurchaseProfile ?? null,
          manualPurchaseIntervalDays: facility.manualPurchaseIntervalDays ?? null,
          lastValidPurchaseDate: facility.lastValidPurchaseDate ?? null,
          purchaseRecurrenceSampleSize: facility.purchaseRecurrenceSampleSize ?? 0,
          purchaseFunnelStage: facility.purchaseFunnelStage,
          nextPurchaseFunnelTransitionDate:
            facility.nextPurchaseFunnelTransitionDate ?? null,
        }
      : undefined;

  return {
    commercialStatus: facility.commercialStatus ?? undefined,
    purchaseStatus: facility.purchaseStatus ?? undefined,
    purchaseRecurrence: legacyRecurrence,
    hasProfileContext: false,
  };
}
