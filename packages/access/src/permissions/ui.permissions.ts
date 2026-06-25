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

export function canReadClinics(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("read", "CLINIC") || ability.can("manage", "CLINIC");
}

export function canManageClinics(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("create", "CLINIC") || ability.can("manage", "CLINIC");
}

export function canReadDoctors(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("read", "DOCTOR") || ability.can("manage", "DOCTOR");
}

export function canManageDoctors(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("create", "DOCTOR") || ability.can("manage", "DOCTOR");
}

export function canReadTerritories(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("read", "TERRITORY") || ability.can("manage", "TERRITORY");
}

export function canManageTerritories(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("manage", "TERRITORY");
}

export function canCreateTerritories(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("create", "TERRITORY") || ability.can("manage", "TERRITORY");
}

export function canUpdateTerritories(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("update", "TERRITORY") || ability.can("manage", "TERRITORY");
}

export function canViewHealth(role: Role): boolean {
  return role === Role.ADMIN;
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}
