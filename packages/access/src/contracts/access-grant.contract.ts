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

/** Maps DB resource names to CASL subjects. */
export const GRANT_RESOURCE_TO_SUBJECT: Record<string, Subject> = {
  USER: "USER",
  CLINIC: "CLINIC",
  DOCTOR: "DOCTOR",
  VISIT: "VISIT",
  TERRITORY: "TERRITORY",
  INVITATION: "INVITATION",
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
