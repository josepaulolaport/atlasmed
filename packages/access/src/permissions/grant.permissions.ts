import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import {
  GRANT_RESOURCE_TO_SUBJECT,
  grantActionToCaslAction,
} from "../contracts/access-grant.contract";
import {
  applyRoleAbilities,
  type Action,
  type AppAbility,
  type Subject,
  defineAbilitiesFor,
} from "./role.permissions";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { Role } from "../enums/role.enum";
import { buildCaslConditionsFromGrant } from "./grant-conditions";

export function applyGrantsToAbility(
  grants: AccessGrantRecord[],
  can: AbilityBuilder<AppAbility>["can"]
): void {
  const grantCan = can as (
    action: Action,
    subjectType: Subject,
    conditions?: Record<string, unknown>
  ) => void;

  for (const grant of grants) {
    const subjectType = GRANT_RESOURCE_TO_SUBJECT[grant.resource.toUpperCase()];
    const action = grantActionToCaslAction(grant.action);

    if (!subjectType || !action) {
      continue;
    }

    const conditions = buildCaslConditionsFromGrant(grant);

    if (conditions) {
      grantCan(action, subjectType, conditions);
    } else {
      can(action, subjectType);
    }
  }
}

export function defineAbilitiesForUser(
  role: Role,
  grants: AccessGrantRecord[] = []
): AppAbility {
  if (grants.length === 0) {
    return defineAbilitiesFor(role);
  }

  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  applyRoleAbilities(role, { can, cannot });
  applyGrantsToAbility(grants, can);
  return build();
}
