import { describe, expect, it } from "bun:test";
import { Role } from "../enums/role.enum";
import { canAccessVertical, resolveAccessibleVerticalIds } from "./vertical.permissions";

describe("canAccessVertical", () => {
  it("allows ADMIN any assigned (active) vertical", () => {
    expect(
      canAccessVertical({
        role: Role.ADMIN,
        assignedVerticalIds: ["v1", "v2"],
        verticalId: "v2",
      })
    ).toBe(true);
  });

  it("denies REP outside assignments", () => {
    expect(
      canAccessVertical({
        role: Role.REP,
        assignedVerticalIds: ["v1"],
        verticalId: "v2",
      })
    ).toBe(false);
  });
});

describe("resolveAccessibleVerticalIds", () => {
  it("returns all assigned when filter omitted", () => {
    expect(
      resolveAccessibleVerticalIds({
        role: Role.OPS,
        assignedVerticalIds: ["v1", "v2"],
      })
    ).toEqual({ ok: true, verticalIds: ["v1", "v2"] });
  });

  it("narrows to filter when allowed", () => {
    expect(
      resolveAccessibleVerticalIds({
        role: Role.MANAGER,
        assignedVerticalIds: ["v1", "v2"],
        filterVerticalId: "v1",
      })
    ).toEqual({ ok: true, verticalIds: ["v1"] });
  });

  it("forbids filter outside assignments", () => {
    expect(
      resolveAccessibleVerticalIds({
        role: Role.REP,
        assignedVerticalIds: ["v1"],
        filterVerticalId: "v2",
      })
    ).toEqual({ ok: false, reason: "forbidden" });
  });
});
