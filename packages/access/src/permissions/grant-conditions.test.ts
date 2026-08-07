import { describe, expect, it } from "bun:test";
import { subject } from "@casl/ability";
import {
  buildCaslConditionsFromGrant,
  GrantConditionValidationError,
  validateGrantConditions,
} from "./grant-conditions";
import { defineAbilitiesForUser } from "./grant.permissions";
import { canOnResource } from "./casl-scoped.helpers";
import { Role } from "../enums/role.enum";

describe("grant conditions", () => {
  it("applies scoped CASL conditions for subjects outside role permissions", () => {
    const withoutGrant = defineAbilitiesForUser(Role.REP, []);
    expect(
      canOnResource(withoutGrant, "read", "FIELD_SUGGESTION", 1)
    ).toBe(false);

    const ability = defineAbilitiesForUser(Role.REP, [
      {
        id: 1,
        resource: "FIELD_SUGGESTION",
        resourceId: "1",
        action: "read",
      },
    ]);

    expect(canOnResource(ability, "read", "FIELD_SUGGESTION", 1)).toBe(
      true
    );
    expect(canOnResource(ability, "read", "FIELD_SUGGESTION", 2)).toBe(
      false
    );
  });

  it("supports scoped id provided only via conditions", () => {
    const ability = defineAbilitiesForUser(Role.REP, [
      {
        id: 2,
        resource: "FIELD_SUGGESTION",
        resourceId: null,
        action: "read",
        conditions: { id: "fs-9" },
      },
    ]);

    expect(
      ability.can(
        "read",
        subject("FIELD_SUGGESTION", { id: "fs-9" }) as never
      )
    ).toBe(true);
    expect(
      ability.can(
        "read",
        subject("FIELD_SUGGESTION", { id: "fs-8" }) as never
      )
    ).toBe(false);
  });

  it("rejects unsupported condition keys at grant time", () => {
    expect(() =>
      validateGrantConditions({
        resource: "FACILITY",
        resourceId: "1",
        conditions: { territoryId: "t-1" },
      })
    ).toThrow(GrantConditionValidationError);
  });

  it("rejects conflicting resourceId and conditions.id", () => {
    expect(() =>
      validateGrantConditions({
        resource: "FACILITY",
        resourceId: "1",
        conditions: { id: "2" },
      })
    ).toThrow(GrantConditionValidationError);
  });

  it("buildCaslConditionsFromGrant prefers resourceId when conflict exists", () => {
    const conditions = buildCaslConditionsFromGrant({
      id: 3,
      resource: "FACILITY",
      resourceId: "1",
      action: "read",
      conditions: { id: "2" },
    });

    expect(conditions).toEqual({ id: "1" });
  });
});
