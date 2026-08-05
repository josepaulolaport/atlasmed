import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import type { Role } from "../enums/role.enum";
import { defineAbilitiesForUser } from "../permissions/grant.permissions";

export const APP_CAPABILITIES = [
  "agenda.read",
  "agenda.create",
  "agenda.update",
  "agenda.delete",
  "catalog.read",
  "catalog.manage",
  "cadastro.read",
  "cadastro.review",
  "field-suggestion.read",
  "field-suggestion.review",
  "facility.read",
  "facility.create",
  "facility.update",
  "facility.delete",
  "professional.read",
  "professional.update",
  "territory.read",
  "territory.create",
  "territory.update",
  "territory.delete",
  "user.read",
  "user.manage",
  "user.lifecycle",
] as const;

export type AppCapability = (typeof APP_CAPABILITIES)[number];

const CAPABILITY_CHECKS: Record<AppCapability, { action: string; subject: string }> = {
  "agenda.read": { action: "read", subject: "CALENDAR" },
  "agenda.create": { action: "create", subject: "CALENDAR" },
  "agenda.update": { action: "update", subject: "CALENDAR" },
  "agenda.delete": { action: "delete", subject: "CALENDAR" },
  "catalog.read": { action: "read", subject: "CATALOG" },
  "catalog.manage": { action: "manage", subject: "CATALOG" },
  "cadastro.read": { action: "read", subject: "CADASTRO_SUBMISSION" },
  "cadastro.review": { action: "update", subject: "CADASTRO_SUBMISSION" },
  "field-suggestion.read": { action: "read", subject: "FIELD_SUGGESTION" },
  "field-suggestion.review": { action: "update", subject: "FIELD_SUGGESTION" },
  "facility.read": { action: "read", subject: "FACILITY" },
  "facility.create": { action: "create", subject: "FACILITY" },
  "facility.update": { action: "update", subject: "FACILITY" },
  "facility.delete": { action: "delete", subject: "FACILITY" },
  "professional.read": { action: "read", subject: "PROFESSIONAL" },
  "professional.update": { action: "update", subject: "PROFESSIONAL" },
  "territory.read": { action: "read", subject: "TERRITORY" },
  "territory.create": { action: "create", subject: "TERRITORY" },
  "territory.update": { action: "update", subject: "TERRITORY" },
  "territory.delete": { action: "delete", subject: "TERRITORY" },
  "user.read": { action: "read", subject: "USER" },
  "user.manage": { action: "manage", subject: "USER" },
  "user.lifecycle": { action: "update", subject: "USER" },
};

export function getAppCapabilities(role: Role, grants: AccessGrantRecord[] = []): AppCapability[] {
  const ability = defineAbilitiesForUser(role, grants);
  return APP_CAPABILITIES.filter((capability) => {
    const check = CAPABILITY_CHECKS[capability];
    return ability.can(check.action as any, check.subject as any);
  });
}
