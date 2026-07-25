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
      can("manage", "FACILITY");
      can("manage", "PROFESSIONAL");
      can("manage", "TERRITORY");
      can("manage", "INVITATION");
      can("manage", "REGISTRY_INGESTION");
      can("manage", "REGISTRY_SUGGESTION");
      can("manage", "SEARCH_SYNC");
      can("manage", "CATALOG");
      can("manage", "VISIT");
      can("manage", "FIELD_SUGGESTION");
      can("manage", "CADASTRO_SUBMISSION");
      break;

    case "MANAGER":
      can("create", "VISIT");
      can("read", "VISIT");
      can("read", "USER");
      can("update", "USER");
      can("create", "USER");
      can("create", "INVITATION");
      can("update", "INVITATION");
      can("delete", "INVITATION");
      can("read", "FACILITY");
      can("update", "FACILITY");
      can("read", "PROFESSIONAL");
      can("update", "PROFESSIONAL");
      can("read", "TERRITORY");
      can("create", "TERRITORY");
      can("update", "TERRITORY");
      can("read", "REGISTRY_SUGGESTION");
      can("update", "REGISTRY_SUGGESTION");
      can("read", "REGISTRY_INGESTION");
      can("read", "CATALOG");
      can("create", "FIELD_SUGGESTION");
      can("read", "FIELD_SUGGESTION");
      can("update", "FIELD_SUGGESTION");
      can("read", "CADASTRO_SUBMISSION");
      can("update", "CADASTRO_SUBMISSION");
      break;

    case "REP":
      can("create", "VISIT");
      can("read", "VISIT");
      can("read", "FACILITY");
      can("update", "FACILITY");
      can("read", "PROFESSIONAL");
      can("update", "PROFESSIONAL");
      can("read", "CATALOG");
      // Mine list is facility-scoped (read FACILITY); ops queue requires read FIELD_SUGGESTION.
      can("create", "FIELD_SUGGESTION");
      cannot("read", "FIELD_SUGGESTION");
      cannot("update", "FIELD_SUGGESTION");
      // Upload/submit uses update FACILITY; ops Cadastro queue requires CADASTRO_SUBMISSION.
      cannot("read", "CADASTRO_SUBMISSION");
      cannot("update", "CADASTRO_SUBMISSION");
      cannot("create", "USER");
      cannot("update", "USER");
      cannot("delete", "USER");
      break;

    case "OPS":
      can("read", "FACILITY");
      can("read", "PROFESSIONAL");
      can("read", "TERRITORY");
      can("read", "USER");
      can("read", "FIELD_SUGGESTION");
      can("update", "FIELD_SUGGESTION");
      cannot("create", "FIELD_SUGGESTION");
      can("read", "CADASTRO_SUBMISSION");
      can("update", "CADASTRO_SUBMISSION");
      cannot("create", "FACILITY");
      cannot("update", "FACILITY");
      cannot("delete", "FACILITY");
      cannot("create", "PROFESSIONAL");
      cannot("update", "PROFESSIONAL");
      cannot("delete", "PROFESSIONAL");
      cannot("create", "USER");
      cannot("update", "USER");
      cannot("delete", "USER");
      cannot("create", "TERRITORY");
      cannot("update", "TERRITORY");
      cannot("delete", "TERRITORY");
      break;
  }
}

export function defineAbilitiesFor(role: Role): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  applyRoleAbilities(role, { can, cannot });
  return build();
}
