import type { Action } from "../permissions/role.permissions";
import type { Subject } from "../subjects/subjects";

/** Active permission row used for CASL and scope expansion. */
export interface AccessGrantRecord {
  id: string;
  resource: string;
  resourceId: string | null;
  action: string;
  conditions?: Record<string, unknown>;
  expiresAt?: Date;
}

/** Legacy grant resource names mapped to canonical values. */
export const LEGACY_GRANT_RESOURCE_ALIASES: Record<string, string> = {
  CLINIC: "FACILITY",
  DOCTOR: "PROFESSIONAL",
};

export function normalizeGrantResource(resource: string): string {
  const upper = resource.toUpperCase();
  return LEGACY_GRANT_RESOURCE_ALIASES[upper] ?? upper;
}

/** Maps DB resource names to CASL subjects. */
export const GRANT_RESOURCE_TO_SUBJECT: Record<string, Subject> = {
  USER: "USER",
  FACILITY: "FACILITY",
  PROFESSIONAL: "PROFESSIONAL",
  VISIT: "VISIT",
  TERRITORY: "TERRITORY",
  INVITATION: "INVITATION",
  REGISTRY_INGESTION: "REGISTRY_INGESTION",
  REGISTRY_SUGGESTION: "REGISTRY_SUGGESTION",
  CATALOG: "CATALOG",
  CLINIC: "FACILITY",
  DOCTOR: "PROFESSIONAL",
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
