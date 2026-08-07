import { subject } from "@casl/ability";
import type { Action, AppAbility, Subject } from "./role.permissions";

type AbilityCheckSubject = Parameters<AppAbility["can"]>[1];

/** CASL subject ids are stored/matched as decimal strings (grant.resource_id text). */
export function toGrantResourceId(resourceId: number): string {
  if (!Number.isSafeInteger(resourceId) || resourceId <= 0) {
    throw new Error("Invalid CRM resource id for CASL grant check");
  }
  return String(resourceId);
}

export function canOnResource(
  ability: AppAbility,
  action: Action,
  subjectType: Subject,
  resourceId: number
): boolean {
  return ability.can(
    action,
    subject(subjectType, {
      id: toGrantResourceId(resourceId),
    }) as unknown as AbilityCheckSubject
  );
}
