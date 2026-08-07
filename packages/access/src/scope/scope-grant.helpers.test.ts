import { describe, expect, it } from "bun:test";
import { createEmptyScopeContext } from "./scope.helpers";
import { mergeGrantsIntoScope } from "./scope-grant.helpers";

describe("mergeGrantsIntoScope", () => {
  it("should merge territory and clinic ids from grants", () => {
    const scope = {
      ...createEmptyScopeContext(),
      assignedVerticalIds: [10],
      activeVerticalId: 10,
    };
    const merged = mergeGrantsIntoScope(scope, [
      {
        id: 1,
        resource: "TERRITORY",
        resourceId: "101",
        action: "read",
      },
      {
        id: 2,
        resource: "FACILITY",
        resourceId: "201",
        action: "read",
      },
    ]);

    expect(merged.grantIds).toEqual([1, 2]);
    expect(merged.effectiveTerritoryIds).toContain(101);
    expect(merged.territoryIds).toContain(101);
    expect(merged.facilityIds).toContain(201);
    expect(merged.isOperationallyActive).toBe(true);
    expect(merged.assignedVerticalIds).toEqual([10]);
    expect(merged.activeVerticalId).toBe(10);
  });
});
