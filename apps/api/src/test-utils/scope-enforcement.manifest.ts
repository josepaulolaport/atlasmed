/**
 * Scope enforcement expectations for use cases that accept ScopeContext (B.2).
 * At least one pattern must appear in the file.
 */
export type ScopeEnforcementKind =
  | "repo-filter"
  | "assert-id"
  | "domain-policy"
  | "inline-scope";

export interface ScopeEnforcementEntry {
  kind: ScopeEnforcementKind;
  patterns: string[];
}

export const SCOPE_ENFORCEMENT_MANIFEST: Record<string, ScopeEnforcementEntry> = {
  "modules/access/application/use-cases/deactivate-user.use-case.ts": {
    kind: "domain-policy",
    patterns: ["assertCanMutateUser"],
  },
  "modules/access/application/use-cases/get-invitations.use-case.ts": {
    kind: "inline-scope",
    patterns: ["scope.isGlobal", "invitedByUserId"],
  },
  "modules/access/application/use-cases/list-users.use-case.ts": {
    kind: "repo-filter",
    patterns: ["managedUserIds", "isGlobal"],
  },
  "modules/access/application/use-cases/resend-invite.use-case.ts": {
    kind: "inline-scope",
    patterns: ["scope.isGlobal", "invitedByUserId"],
  },
  "modules/access/application/use-cases/suspend-user.use-case.ts": {
    kind: "domain-policy",
    patterns: ["assertCanMutateUser"],
  },
  "modules/access/application/use-cases/unsuspend-user.use-case.ts": {
    kind: "domain-policy",
    patterns: ["assertCanMutateUser"],
  },

  "modules/catalog/application/use-cases/catalog.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facility"],
  },

  "modules/calendar/application/use-cases/calendar.use-cases.ts": {
    kind: "inline-scope",
    patterns: ["scope.isGlobal", "facilityIds"],
  },

  "modules/facility/application/use-cases/conformity.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/facility-cadastro.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/cadastro-submission.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/facility-consultant.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/facility.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facilityIds"],
  },
  "modules/facility/application/use-cases/facility-note.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/facility-photo.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/list-map-facility-points.use-case.ts": {
    kind: "repo-filter",
    patterns: ["buildFacilityListScope", "listMapPoints"],
  },
  "modules/facility/application/use-cases/visit.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },

  "modules/dashboard/application/get-dashboard-summary.use-case.ts": {
    kind: "repo-filter",
    patterns: ["facilityIds", "isGlobal"],
  },

  "modules/field-suggestions/application/use-cases/field-suggestion.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facilityIds"],
  },

  "modules/interactions/application/use-cases/interaction.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facility"],
  },

  "modules/orders/application/use-cases/orders.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facilityIds"],
  },

  "modules/person/application/use-cases/person-facility-projection.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facility"],
  },
  "modules/person/application/use-cases/list-healthcare-professionals.use-case.ts": {
    kind: "repo-filter",
    patterns: ["facilityIds", "isGlobal", "activeFacilityIds"],
  },

  "modules/potential/application/use-cases/potential.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },

  "modules/territory/application/use-cases/territory-boundary.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerReadableTerritory", "assertTerritorialJurisdiction"],
  },
  "modules/territory/application/use-cases/territory-crud.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerReadScope", "effectiveTerritoryIds"],
  },
  "modules/territory/application/use-cases/territory-membership.use-cases.ts": {
    kind: "inline-scope",
    patterns: ["scope.isGlobal", "facilityIds"],
  },

  "modules/visits/application/use-cases/visit.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facilityIds"],
  },
};

/** Use-case files that accept scope in routes but are intentionally exempt from row guards. */
export const SCOPE_ENFORCEMENT_EXEMPT = new Set<string>([
  // Admin-only assignment; CASL manage USER is the gate.
  "modules/access/application/use-cases/assign-user-territory.use-case.ts",
  "modules/access/application/use-cases/get-user-assignments.use-case.ts",
  "modules/access/application/use-cases/revoke-user-territory.use-case.ts",
]);
