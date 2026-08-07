import { describe, expect, it } from "bun:test";
import { Role } from "../enums/role.enum";
import { canAccessVertical, resolveAccessibleVerticalIds } from "./vertical.permissions";

describe("canAccessVertical", () => {
  it("allows ADMIN any assigned (active) vertical", () => {
    expect(
      canAccessVertical({
        role: Role.ADMIN,
        assignedVerticalIds: [1, 2],
        verticalId: 2,
      })
    ).toBe(true);
  });

  it("denies ADMIN filter when assigned list is empty", () => {
    expect(
      canAccessVertical({
        role: Role.ADMIN,
        assignedVerticalIds: [],
        verticalId: 1,
      })
    ).toBe(false);
  });

  it("denies ADMIN filter outside active assigns", () => {
    expect(
      canAccessVertical({
        role: Role.ADMIN,
        assignedVerticalIds: [1, 2],
        verticalId: 99,
      })
    ).toBe(false);
  });

  it("denies REP outside assignments", () => {
    expect(
      canAccessVertical({
        role: Role.REP,
        assignedVerticalIds: [1],
        verticalId: 2,
      })
    ).toBe(false);
  });
});

describe("resolveAccessibleVerticalIds", () => {
  it("returns all assigned when filter omitted", () => {
    expect(
      resolveAccessibleVerticalIds({
        role: Role.OPS,
        assignedVerticalIds: [1, 2],
      })
    ).toEqual({ ok: true, verticalIds: [1, 2] });
  });

  it("narrows to filter when allowed", () => {
    expect(
      resolveAccessibleVerticalIds({
        role: Role.MANAGER,
        assignedVerticalIds: [1, 2],
        filterVerticalId: 1,
      })
    ).toEqual({ ok: true, verticalIds: [1] });
  });

  it("forbids filter outside assignments", () => {
    expect(
      resolveAccessibleVerticalIds({
        role: Role.REP,
        assignedVerticalIds: [1],
        filterVerticalId: 2,
      })
    ).toEqual({ ok: false, reason: "forbidden" });
  });
});
