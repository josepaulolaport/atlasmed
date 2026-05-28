import type { MongoAbility } from "@casl/ability";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { Role } from "../enums/role.enum";
import type { Subject } from "../subjects/subjects";

export type { Subject };
export type Action = "create" | "read" | "update" | "delete" | "manage";

export type AppAbility = MongoAbility<[Action, Subject]>;

export function applyRoleAbilities(
  role: Role,
  { can, cannot }: Pick<AbilityBuilder<AppAbility>, "can" | "cannot">
): void {
  switch (role) {
    case "ADMIN":
      can("manage", "USER");
      can("manage", "CLINIC");
      can("manage", "DOCTOR");
      can("manage", "VISIT");
      can("manage", "TERRITORY");
      can("manage", "INVITATION");
      break;

    case "MANAGER":
      can("read", "USER");
      can("update", "USER");
      can("create", "USER");
      can("create", "INVITATION");
      can("update", "INVITATION");
      can("delete", "INVITATION");
      can("read", "CLINIC");
      can("read", "DOCTOR");
      can("read", "VISIT");
      can("read", "TERRITORY");
      break;

    case "USER":
      can("read", "CLINIC");
      can("read", "DOCTOR");
      can("read", "VISIT");
      cannot("create", "USER");
      cannot("update", "USER");
      cannot("delete", "USER");
      break;
  }
}

export function defineAbilitiesFor(role: Role): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  applyRoleAbilities(role, { can, cannot });
  return build();
}
