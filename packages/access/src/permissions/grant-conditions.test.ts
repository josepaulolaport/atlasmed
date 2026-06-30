import { describe, expect, it } from "bun:test";
import { subject } from "@casl/ability";
import {
  buildCaslConditionsFromGrant,
  GrantConditionValidationError,
  validateGrantConditions,
} from "./grant-conditions";
import { defineAbilitiesForUser } from "./grant.permissions";
import { canOnResource } from "./casl-scoped.helpers";

describe("grant conditions", () => {
  it("applies scoped CASL conditions for subjects outside role permissions", () => {
    const withoutGrant = defineAbilitiesForUser("USER", []);
    expect(
      canOnResource(withoutGrant, "read", "REGISTRY_SUGGESTION", "sug-1")
    ).toBe(false);

    const ability = defineAbilitiesForUser("USER", [
      {
        id: "grant-1",
        resource: "REGISTRY_SUGGESTION",
        resourceId: "sug-1",
        action: "read",
      },
    ]);

    expect(canOnResource(ability, "read", "REGISTRY_SUGGESTION", "sug-1")).toBe(
      true
    );
    expect(canOnResource(ability, "read", "REGISTRY_SUGGESTION", "sug-2")).toBe(
      false
    );
  });

  it("supports scoped id provided only via conditions", () => {
    const ability = defineAbilitiesForUser("USER", [
      {
        id: "grant-2",
        resource: "REGISTRY_SUGGESTION",
        resourceId: null,
        action: "read",
        conditions: { id: "sug-9" },
      },
    ]);

    expect(
      ability.can(
        "read",
        subject("REGISTRY_SUGGESTION", { id: "sug-9" }) as never
      )
    ).toBe(true);
    expect(
      ability.can(
        "read",
        subject("REGISTRY_SUGGESTION", { id: "sug-8" }) as never
      )
    ).toBe(false);
  });

  it("rejects unsupported condition keys at grant time", () => {
    expect(() =>
      validateGrantConditions({
        resource: "FACILITY",
        resourceId: "facility-1",
        conditions: { territoryId: "t-1" },
      })
    ).toThrow(GrantConditionValidationError);
  });

  it("rejects conflicting resourceId and conditions.id", () => {
    expect(() =>
      validateGrantConditions({
        resource: "FACILITY",
        resourceId: "facility-1",
        conditions: { id: "facility-2" },
      })
    ).toThrow(GrantConditionValidationError);
  });

  it("buildCaslConditionsFromGrant prefers resourceId when conflict exists", () => {
    const conditions = buildCaslConditionsFromGrant({
      id: "grant-3",
      resource: "FACILITY",
      resourceId: "facility-1",
      action: "read",
      conditions: { id: "facility-2" },
    });

    expect(conditions).toEqual({ id: "facility-1" });
  });
});
