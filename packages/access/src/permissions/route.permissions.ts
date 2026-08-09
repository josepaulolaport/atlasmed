import type { Role } from "../enums/role.enum";
import {
  defineAbilitiesFor,
  type Action,
  type Subject,
} from "./role.permissions";

/**
 * Route-level permission check (list/create endpoints without a resource id).
 * Role CASL only — AccessGrants removed.
 */
export function canAccessRoute(
  role: Role,
  action: Action,
  subjectType: Subject
): boolean {
  return defineAbilitiesFor(role).can(action, subjectType);
}

/**
 * Instance-level permission check (routes with :id param).
 * Role CASL only — AccessGrants removed (no resource-scoped overrides).
 */
export function canAccessResource(
  role: Role,
  action: Action,
  subjectType: Subject,
  _resourceId: number
): boolean {
  return canAccessRoute(role, action, subjectType);
}
