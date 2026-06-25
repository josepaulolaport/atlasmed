import { describe, expect, it } from "bun:test";
import { serializeBoundaryResolution } from "./territory-boundary-resolution.utils";

describe("serializeBoundaryResolution", () => {
  it("serializes operational patch resolution", () => {
    const result = serializeBoundaryResolution({
      mode: "operational",
      geoMembershipStatus: "ready",
      membershipCount: 2,
      referenceTerritoryIds: ["sp", "mun-1"],
    });

    expect(result).toEqual({
      success: true,
      mode: "operational",
      geoMembershipStatus: "ready",
      membershipCount: 2,
      referenceTerritoryIds: ["sp", "mun-1"],
    });
  });

  it("serializes reference geography resolution", () => {
    const result = serializeBoundaryResolution({
      mode: "reference",
      parentAssignmentStatus: "resolved",
      parentAssignmentSource: "geo",
      primaryParentId: "parent-1",
      rollupAncestorIds: ["rollup-1"],
      candidates: [{ id: "c-1", code: "BR-UF-SP", overlapRatio: 0.9 }],
    });

    expect(result).toEqual({
      success: true,
      mode: "reference",
      parentAssignmentStatus: "resolved",
      parentAssignmentSource: "geo",
      primaryParentId: "parent-1",
      rollupAncestorIds: ["rollup-1"],
      candidates: [{ id: "c-1", code: "BR-UF-SP", overlapRatio: 0.9 }],
    });
  });
});
