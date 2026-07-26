import { describe, expect, it } from "bun:test";
import { createEmptyScopeContext } from "./scope.helpers";
import { mergeGrantsIntoScope } from "./scope-grant.helpers";

describe("mergeGrantsIntoScope", () => {
  it("should merge territory and clinic ids from grants", () => {
    const scope = {
      ...createEmptyScopeContext(),
      assignedVerticalIds: ["vertical-a"],
      activeVerticalId: "vertical-a",
    };
    const merged = mergeGrantsIntoScope(scope, [
      {
        id: "g1",
        resource: "TERRITORY",
        resourceId: "t-1",
        action: "read",
      },
      {
        id: "g2",
        resource: "FACILITY",
        resourceId: "c-1",
        action: "read",
      },
    ]);

    expect(merged.grantIds).toEqual(["g1", "g2"]);
    expect(merged.effectiveTerritoryIds).toContain("t-1");
    expect(merged.territoryIds).toContain("t-1");
    expect(merged.facilityIds).toContain("c-1");
    expect(merged.isOperationallyActive).toBe(true);
    expect(merged.assignedVerticalIds).toEqual(["vertical-a"]);
    expect(merged.activeVerticalId).toBe("vertical-a");
  });
});
