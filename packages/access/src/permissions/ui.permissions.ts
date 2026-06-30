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

export function canReadFacilities(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("read", "FACILITY") || ability.can("manage", "FACILITY");
}

export function canManageFacilities(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("create", "FACILITY") || ability.can("manage", "FACILITY");
}

export function canReadProfessionals(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("read", "PROFESSIONAL") || ability.can("manage", "PROFESSIONAL");
}

export function canManageProfessionals(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("create", "PROFESSIONAL") || ability.can("manage", "PROFESSIONAL");
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

export function canManageCatalog(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can("manage", "CATALOG");
}

export function canReadCatalog(role: Role): boolean {
  const ability = defineAbilitiesFor(role);
  return (
    ability.can("read", "CATALOG") ||
    ability.can("create", "CATALOG") ||
    ability.can("update", "CATALOG") ||
    ability.can("manage", "CATALOG")
  );
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}
