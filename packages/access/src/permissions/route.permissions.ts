import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import { GRANT_RESOURCE_TO_SUBJECT } from "../contracts/access-grant.contract";
import type { Role } from "../enums/role.enum";
import {
  defineAbilitiesFor,
  type Action,
  type Subject,
} from "./role.permissions";
import { defineAbilitiesForUser } from "./grant.permissions";
import { grantActionToCaslAction } from "../contracts/access-grant.contract";
import { canOnResource } from "./casl-scoped.helpers";

/** Grants without a resourceId (global overrides). */
export function getGlobalGrants(grants: AccessGrantRecord[]): AccessGrantRecord[] {
  return grants.filter((grant) => !grant.resourceId);
}

/**
 * Route-level permission check (list/create endpoints without a resource id).
 * Resource-scoped grants do NOT satisfy this check.
 */
export function canAccessRoute(
  role: Role,
  grants: AccessGrantRecord[],
  action: Action,
  subjectType: Subject
): boolean {
  if (defineAbilitiesFor(role).can(action, subjectType)) {
    return true;
  }

  const globalGrants = getGlobalGrants(grants);
  if (globalGrants.length === 0) {
    return false;
  }

  return defineAbilitiesForUser(role, globalGrants).can(action, subjectType);
}

/**
 * Instance-level permission check (routes with :id param).
 * Allows role-wide access OR a matching resource-scoped grant.
 */
export function canAccessResource(
  role: Role,
  grants: AccessGrantRecord[],
  action: Action,
  subjectType: Subject,
  resourceId: string
): boolean {
  if (canAccessRoute(role, grants, action, subjectType)) {
    return true;
  }

  return canOnResource(
    defineAbilitiesForUser(role, grants),
    action,
    subjectType,
    resourceId
  );
}

export function isValidGrantResource(resource: string): boolean {
  return resource.toUpperCase() in GRANT_RESOURCE_TO_SUBJECT;
}

export function isValidGrantAction(action: string): boolean {
  return grantActionToCaslAction(action) !== null;
}
