import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { describe, expect, it } from "bun:test";
import type { AppAbility } from "./role.permissions";
import { serializeAbilityRules } from "./ability-rule-serialization";

describe("serializeAbilityRules", () => {
  it("projects ordered positive and inverted type-level CASL rules", () => {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("manage", "USER");
    cannot("update", "USER");
    can("read", "PERSON");

    expect(serializeAbilityRules(build())).toEqual([
      { action: "manage", subject: "USER" },
      { action: "update", subject: "USER", inverted: true },
      { action: "read", subject: "PERSON" },
    ]);
  });

  it("omits conditional rules so a type-level snapshot cannot broaden scoped access", () => {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("read", "FACILITY");
    (can as (action: "read", subject: "FACILITY", conditions: { id: string }) => void)(
      "read",
      "FACILITY",
      { id: "facility-1" },
    );
    can("update", "FACILITY");

    expect(serializeAbilityRules(build())).toEqual([
      { action: "read", subject: "FACILITY" },
      { action: "update", subject: "FACILITY" },
    ]);
  });
});
