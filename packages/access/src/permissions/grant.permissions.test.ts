import { describe, expect, it } from "bun:test";
import { defineAbilitiesForUser } from "./grant.permissions";
import { defineAbilitiesFor } from "./role.permissions";
import { Role } from "../enums/role.enum";

describe("defineAbilitiesForUser", () => {
  it("should match base role abilities when no grants", () => {
    const base = defineAbilitiesFor(Role.USER);
    const merged = defineAbilitiesForUser(Role.USER, []);

    expect(merged.can("read", "CLINIC")).toBe(base.can("read", "CLINIC"));
    expect(merged.can("create", "USER")).toBe(base.can("create", "USER"));
  });

  it("should add grant abilities on top of role", () => {
    const merged = defineAbilitiesForUser(Role.USER, [
      {
        id: "grant-1",
        resource: "CLINIC",
        resourceId: "clinic-1",
        action: "update",
      },
    ]);

    expect(merged.can("read", "CLINIC")).toBe(true);
    expect(merged.can("update", "CLINIC")).toBe(true);
  });
});
