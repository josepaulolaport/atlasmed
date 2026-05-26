import { Role } from "../enums/role.enum";
import { defineAbilitiesFor } from "./role.permissions";

const ROLE_PRIORITY: Record<Role, number> = {
  [Role.ADMIN]: 3,
  [Role.MANAGER]: 2,
  [Role.USER]: 1,
};

export function hasMinimumRole(userRole: Role, required: Role): boolean {
  return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[required];
}

export function canManageUsers(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("read", "USER") || ability.can("manage", "USER");
}

export function canViewHealth(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("manage", "TERRITORY");
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}
