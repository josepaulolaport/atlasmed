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
      can("manage", "PERSON");
      can("manage", "TERRITORY");
      can("manage", "INVITATION");
      can("manage", "SEARCH_SYNC");
      can("manage", "CATALOG");
      can("manage", "VISIT");
      can("manage", "CALENDAR");
      can("manage", "INTERACTION");
      can("manage", "FIELD_SUGGESTION");
      can("manage", "CADASTRO_SUBMISSION");
      can("manage", "ROTEIRO");
      break;

    case "MANAGER":
      can("create", "VISIT");
      can("read", "VISIT");
      can("read", "CALENDAR");
      can("read", "INTERACTION");
      can("read", "USER");
      can("update", "USER");
      can("create", "USER");
      can("create", "INVITATION");
      can("update", "INVITATION");
      can("delete", "INVITATION");
      can("read", "FACILITY");
      can("update", "FACILITY");
      can("read", "PERSON");
      can("create", "PERSON");
      can("update", "PERSON");
      can("read", "TERRITORY");
      can("create", "TERRITORY");
      can("update", "TERRITORY");
      can("read", "CATALOG");
      can("create", "FIELD_SUGGESTION");
      can("read", "FIELD_SUGGESTION");
      can("update", "FIELD_SUGGESTION");
      // Cadastro review is back-office work — OPS and ADMIN only (ADR 0008).
      // A MANAGER still uploads and submits documents for their clinics; that
      // uses `update FACILITY`, not this subject.
      //
      // This is enforced by `requirePermission` on the review routes. It does
      // *not* hide anything in the client: `canReadCadastroSubmissions` is
      // exported but has no consumer, and nothing navigates to the review
      // screen at all today.
      cannot("read", "CADASTRO_SUBMISSION");
      cannot("update", "CADASTRO_SUBMISSION");
      // A manager may read their reps' plans and draft one for them (spec 0016
      // S16), but confirming writes to the rep's calendar and is gated on
      // INTERACTION, which stays owner-only. Manager proposes, rep accepts.
      can("read", "ROTEIRO");
      can("create", "ROTEIRO");
      cannot("delete", "ROTEIRO");
      break;

    case "REP":
      can("create", "VISIT");
      can("read", "VISIT");
      can("create", "CALENDAR");
      can("read", "CALENDAR");
      can("update", "CALENDAR");
      can("delete", "CALENDAR");
      can("create", "INTERACTION");
      can("read", "INTERACTION");
      can("update", "INTERACTION");
      can("delete", "INTERACTION");
      can("read", "FACILITY");
      can("update", "FACILITY");
      can("read", "PERSON");
      can("create", "PERSON");
      can("update", "PERSON");
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
      // Their own day: generate, edit, discard.
      can("create", "ROTEIRO");
      can("read", "ROTEIRO");
      can("update", "ROTEIRO");
      can("delete", "ROTEIRO");
      break;

    case "OPS":
      can("read", "FACILITY");
      can("read", "PERSON");
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
      cannot("create", "PERSON");
      cannot("update", "PERSON");
      cannot("delete", "PERSON");
      cannot("create", "USER");
      cannot("update", "USER");
      cannot("delete", "USER");
      cannot("create", "TERRITORY");
      cannot("update", "TERRITORY");
      cannot("delete", "TERRITORY");
      // OPS tunes the engine's parameters but does not plan anyone's day.
      can("read", "ROTEIRO");
      can("update", "ROTEIRO");
      cannot("create", "ROTEIRO");
      cannot("delete", "ROTEIRO");
      break;
  }
}

export function defineAbilitiesFor(role: Role): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  applyRoleAbilities(role, { can, cannot });
  return build();
}
