import { subject } from "@casl/ability";
import type { Action, AppAbility, Subject } from "./role.permissions";

type AbilityCheckSubject = Parameters<AppAbility["can"]>[1];

export function canOnResource(
  ability: AppAbility,
  action: Action,
  subjectType: Subject,
  resourceId: string
): boolean {
  return ability.can(
    action,
    subject(subjectType, { id: resourceId }) as unknown as AbilityCheckSubject
  );
}
