import { describe, expect, it } from "bun:test";
import { defineAbilitiesForUser } from "./grant.permissions";
import { defineAbilitiesFor } from "./role.permissions";
import { Role } from "../enums/role.enum";
import { canAccessRoute, canAccessResource } from "./route.permissions";
import { canOnResource } from "./casl-scoped.helpers";

describe("defineAbilitiesForUser", () => {
  it("should match base role abilities when no grants", () => {
    const base = defineAbilitiesFor(Role.USER);
    const merged = defineAbilitiesForUser(Role.USER, []);

    expect(merged.can("read", "CLINIC")).toBe(base.can("read", "CLINIC"));
    expect(merged.can("create", "USER")).toBe(base.can("create", "USER"));
  });

  it("does not grant route-level update via canAccessRoute for scoped grant alone", () => {
    const grants = [
      {
        id: "grant-1",
        resource: "CLINIC",
        resourceId: "clinic-1",
        action: "update",
      },
    ];

    expect(canAccessRoute(Role.USER, grants, "update", "CLINIC")).toBe(false);
    expect(canAccessResource(Role.USER, grants, "update", "CLINIC", "clinic-1")).toBe(
      true
    );
  });

  it("should scope grant abilities to a specific resource id", () => {
    const merged = defineAbilitiesForUser(Role.USER, [
      {
        id: "grant-1",
        resource: "CLINIC",
        resourceId: "clinic-1",
        action: "update",
      },
    ]);

    expect(
      canOnResource(merged, "update", "CLINIC", "clinic-1")
    ).toBe(true);
    expect(
      canOnResource(merged, "update", "CLINIC", "clinic-2")
    ).toBe(false);
  });
});

describe("route permission helpers", () => {
  it("canAccessRoute ignores resource-scoped grants", () => {
    const grants = [
      {
        id: "grant-1",
        resource: "CLINIC",
        resourceId: "clinic-1",
        action: "update",
      },
    ];

    expect(canAccessRoute(Role.USER, grants, "update", "CLINIC")).toBe(false);
  });

  it("canAccessResource allows scoped grant for matching id", () => {
    const grants = [
      {
        id: "grant-1",
        resource: "CLINIC",
        resourceId: "clinic-1",
        action: "update",
      },
    ];

    expect(canAccessResource(Role.USER, grants, "update", "CLINIC", "clinic-1")).toBe(
      true
    );
    expect(canAccessResource(Role.USER, grants, "update", "CLINIC", "clinic-2")).toBe(
      false
    );
  });
});
