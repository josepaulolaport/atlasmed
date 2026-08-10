import { defineAbilitiesForUser, type Role } from "@atlasmed/access";
import type { AccessGrantRecord } from "@atlasmed/access";

export const APP_CAPABILITY_ACTIONS = {
  agenda: ["read", "create", "update", "delete"],
  catalog: ["read", "manage"],
  cadastro: ["read", "review"],
  "field-suggestion": ["read", "review"],
  facility: ["read", "create", "update", "delete"],
  professional: ["read", "update"],
  territory: ["read", "create", "update", "delete"],
  user: ["read", "manage", "lifecycle"],
} as const;

export type AppCapabilityResource = keyof typeof APP_CAPABILITY_ACTIONS;
export type AppCapabilityAction =
  (typeof APP_CAPABILITY_ACTIONS)[AppCapabilityResource][number];
export interface AppCapability {
  resource: AppCapabilityResource;
  actions: AppCapabilityAction[];
}

type CapabilityCheck = { action: string; subject: string };
type CapabilityChecks = {
  [Resource in AppCapabilityResource]: Record<
    (typeof APP_CAPABILITY_ACTIONS)[Resource][number],
    CapabilityCheck
  >;
};

const CAPABILITY_CHECKS = {
  agenda: {
    read: { action: "read", subject: "CALENDAR" },
    create: { action: "create", subject: "CALENDAR" },
    update: { action: "update", subject: "CALENDAR" },
    delete: { action: "delete", subject: "CALENDAR" },
  },
  catalog: {
    read: { action: "read", subject: "CATALOG" },
    manage: { action: "manage", subject: "CATALOG" },
  },
  cadastro: {
    read: { action: "read", subject: "CADASTRO_SUBMISSION" },
    review: { action: "update", subject: "CADASTRO_SUBMISSION" },
  },
  "field-suggestion": {
    read: { action: "read", subject: "FIELD_SUGGESTION" },
    review: { action: "update", subject: "FIELD_SUGGESTION" },
  },
  facility: {
    read: { action: "read", subject: "FACILITY" },
    create: { action: "create", subject: "FACILITY" },
    update: { action: "update", subject: "FACILITY" },
    delete: { action: "delete", subject: "FACILITY" },
  },
  professional: {
    read: { action: "read", subject: "PROFESSIONAL" },
    update: { action: "update", subject: "PROFESSIONAL" },
  },
  territory: {
    read: { action: "read", subject: "TERRITORY" },
    create: { action: "create", subject: "TERRITORY" },
    update: { action: "update", subject: "TERRITORY" },
    delete: { action: "delete", subject: "TERRITORY" },
  },
  user: {
    read: { action: "read", subject: "USER" },
    manage: { action: "manage", subject: "USER" },
    lifecycle: { action: "update", subject: "USER" },
  },
} satisfies CapabilityChecks;

export function getAppCapabilities(
  role: Role,
  grants: AccessGrantRecord[] = [],
): AppCapability[] {
  const ability = defineAbilitiesForUser(role, grants);

  return Object.entries(APP_CAPABILITY_ACTIONS).flatMap(([resource, actions]) => {
    const checks = CAPABILITY_CHECKS[resource as AppCapabilityResource] as Record<
      AppCapabilityAction,
      CapabilityCheck
    >;
    const grantedActions = actions.filter((action) => {
      const check = checks[action];
      return ability.can(check.action as never, check.subject as never);
    });

    return grantedActions.length > 0
      ? [{ resource: resource as AppCapabilityResource, actions: grantedActions }]
      : [];
  });
}
