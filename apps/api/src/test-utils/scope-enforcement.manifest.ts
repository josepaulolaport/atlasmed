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

  "modules/facility/application/use-cases/conformity.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/facility-professional.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/facility-registry.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/facility/application/use-cases/facility.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "facilityIds"],
  },

  "modules/professional/application/use-cases/professional.use-cases.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope", "assertProfessionalAccessible", "facilityIds"],
  },

  "modules/registry-ingestion/application/services/registry-read.service.ts": {
    kind: "assert-id",
    patterns: ["assertResourceInScope"],
  },
  "modules/registry-ingestion/application/use-cases/suggestion.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertSuggestionInScope", "resolveSuggestionFacilityScope", "facilityIds"],
  },

  "modules/territory/application/use-cases/territory-approval.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerTerritoryApprovalRequest", "territory-scope-policy"],
  },
  "modules/territory/application/use-cases/territory-boundary.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerReadableTerritory", "assertLeafTerritoryInJurisdiction"],
  },
  "modules/territory/application/use-cases/territory-coverage.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerReadableTerritory", "resolveReadableTerritoryIds"],
  },
  "modules/territory/application/use-cases/territory-crud.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerReadableTerritory", "resolveReadableTerritoryIds"],
  },
  "modules/territory/application/use-cases/territory-geo-membership.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerReadableTerritory"],
  },
  "modules/territory/application/use-cases/territory-membership.use-cases.ts": {
    kind: "inline-scope",
    patterns: ["scope.isGlobal", "facilityIds"],
  },
  "modules/territory/application/use-cases/territory-rollup.use-cases.ts": {
    kind: "domain-policy",
    patterns: ["assertManagerReadableTerritory"],
  },
};

/** Use-case files that accept scope in routes but are intentionally exempt from row guards. */
export const SCOPE_ENFORCEMENT_EXEMPT = new Set<string>([
  // Admin-only assignment; CASL manage USER is the gate.
  "modules/access/application/use-cases/assign-user-manager.use-case.ts",
  "modules/access/application/use-cases/assign-user-territory.use-case.ts",
  "modules/access/application/use-cases/get-user-assignments.use-case.ts",
  "modules/access/application/use-cases/revoke-user-territory.use-case.ts",
]);
