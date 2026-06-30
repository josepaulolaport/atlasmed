import { describe, expect, it } from "bun:test";
import { defineAbilitiesFor } from "./role.permissions";
import { Role } from "../enums/role.enum";
import { defineAbilitiesForUser } from "./grant.permissions";
import { canAccessRoute, canAccessResource } from "./route.permissions";
import { canOnResource } from "./casl-scoped.helpers";

describe("defineAbilitiesForUser", () => {
  it("should match base role abilities when no grants", () => {
    const base = defineAbilitiesFor(Role.USER);
    const merged = defineAbilitiesForUser(Role.USER, []);

    expect(merged.can("read", "FACILITY")).toBe(base.can("read", "FACILITY"));
    expect(merged.can("update", "FACILITY")).toBe(base.can("update", "FACILITY"));
    expect(merged.can("create", "USER")).toBe(base.can("create", "USER"));
  });

  it("allows route-level facility update for USER via role permissions", () => {
    const grants = [
      {
        id: "grant-1",
        resource: "FACILITY",
        resourceId: "facility-1",
        action: "update",
      },
    ];

    expect(canAccessRoute(Role.USER, grants, "update", "FACILITY")).toBe(true);
    expect(
      canAccessResource(Role.USER, grants, "update", "FACILITY", "facility-1")
    ).toBe(true);
  });

  it("should allow role-wide facility update for any facility id", () => {
    const merged = defineAbilitiesForUser(Role.USER, [
      {
        id: "grant-1",
        resource: "FACILITY",
        resourceId: "facility-1",
        action: "update",
      },
    ]);

    expect(canOnResource(merged, "update", "FACILITY", "facility-1")).toBe(true);
    expect(canOnResource(merged, "update", "FACILITY", "facility-2")).toBe(true);
  });

  it("maps legacy CLINIC grants to FACILITY subject", () => {
    const withoutGrant = defineAbilitiesForUser(Role.USER, []);
    expect(canOnResource(withoutGrant, "delete", "FACILITY", "facility-1")).toBe(
      false
    );

    const merged = defineAbilitiesForUser(Role.USER, [
      {
        id: "grant-legacy",
        resource: "CLINIC",
        resourceId: "facility-1",
        action: "delete",
      },
    ]);

    expect(canOnResource(merged, "delete", "FACILITY", "facility-1")).toBe(true);
    expect(canOnResource(merged, "delete", "FACILITY", "facility-2")).toBe(false);
  });
});

describe("role catalog permissions", () => {
  it("allows only ADMIN to access catalog", () => {
    expect(defineAbilitiesFor(Role.ADMIN).can("read", "CATALOG")).toBe(true);
    expect(defineAbilitiesFor(Role.ADMIN).can("manage", "CATALOG")).toBe(true);
    expect(defineAbilitiesFor(Role.MANAGER).can("read", "CATALOG")).toBe(false);
    expect(defineAbilitiesFor(Role.USER).can("read", "CATALOG")).toBe(false);
  });
});

describe("route permission helpers", () => {
  it("canAccessRoute uses role-wide facility update for USER", () => {
    const grants = [
      {
        id: "grant-1",
        resource: "FACILITY",
        resourceId: "facility-1",
        action: "update",
      },
    ];

    expect(canAccessRoute(Role.USER, grants, "update", "FACILITY")).toBe(true);
  });

  it("canAccessResource allows USER facility update for matching and other ids", () => {
    const grants = [
      {
        id: "grant-1",
        resource: "FACILITY",
        resourceId: "facility-1",
        action: "update",
      },
    ];

    expect(
      canAccessResource(Role.USER, grants, "update", "FACILITY", "facility-1")
    ).toBe(true);
    expect(
      canAccessResource(Role.USER, grants, "update", "FACILITY", "facility-2")
    ).toBe(true);
  });
});
