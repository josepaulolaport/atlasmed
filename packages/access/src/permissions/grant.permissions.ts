import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { Role } from "../enums/role.enum";
import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import {
  GRANT_RESOURCE_TO_SUBJECT,
  grantActionToCaslAction,
} from "../contracts/access-grant.contract";
import {
  applyRoleAbilities,
  type AppAbility,
  defineAbilitiesFor,
} from "./role.permissions";

export function applyGrantsToAbility(
  grants: AccessGrantRecord[],
  can: AbilityBuilder<AppAbility>["can"]
): void {
  for (const grant of grants) {
    const subject = GRANT_RESOURCE_TO_SUBJECT[grant.resource.toUpperCase()];
    const action = grantActionToCaslAction(grant.action);

    if (!subject || !action) {
      continue;
    }

    can(action, subject);
  }
}

export function defineAbilitiesForUser(
  role: Role,
  grants: AccessGrantRecord[] = []
): AppAbility {
  if (grants.length === 0) {
    return defineAbilitiesFor(role);
  }

  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
  applyRoleAbilities(role, { can, cannot });
  applyGrantsToAbility(grants, can);
  return build() as AppAbility;
}
