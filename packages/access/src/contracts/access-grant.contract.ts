import type { Action } from "../permissions/role.permissions";
import type { Subject } from "../subjects/subjects";

/** Active permission row used for CASL and scope expansion. */
export interface AccessGrantRecord {
  id: number;
  resource: string;
  resourceId: string | null;
  action: string;
  conditions?: Record<string, unknown>;
  expiresAt?: Date;
  grantedAt?: Date;
}

/** Legacy grant resource names mapped to canonical values. */
export const LEGACY_GRANT_RESOURCE_ALIASES: Record<string, string> = {
  CLINIC: "FACILITY",
  DOCTOR: "PERSON",
};

export function normalizeGrantResource(resource: string): string {
  const upper = resource.toUpperCase();
  return LEGACY_GRANT_RESOURCE_ALIASES[upper] ?? upper;
}

/** Maps DB resource names to CASL subjects. */
export const GRANT_RESOURCE_TO_SUBJECT: Record<string, Subject> = {
  USER: "USER",
  FACILITY: "FACILITY",
  PERSON: "PERSON",
  /** Legacy grant resource — maps to PERSON after Slice C. */
  PROFESSIONAL: "PERSON",
  TERRITORY: "TERRITORY",
  INVITATION: "INVITATION",
  CATALOG: "CATALOG",
  SEARCH_SYNC: "SEARCH_SYNC",
  VISIT: "VISIT",
  FIELD_SUGGESTION: "FIELD_SUGGESTION",
  CADASTRO_SUBMISSION: "CADASTRO_SUBMISSION",
  CLINIC: "FACILITY",
  DOCTOR: "PERSON",
};

export function grantActionToCaslAction(action: string): Action | null {
  const normalized = action.toLowerCase();
  if (
    normalized === "create" ||
    normalized === "read" ||
    normalized === "update" ||
    normalized === "delete" ||
    normalized === "manage"
  ) {
    return normalized as Action;
  }
  return null;
}
