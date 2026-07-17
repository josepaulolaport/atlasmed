import { describe, expect, it } from "bun:test";
import { serializeBoundaryResolution } from "./territory-boundary-resolution.utils";

describe("serializeBoundaryResolution", () => {
  it("serializes rep patch resolution", () => {
    expect(
      serializeBoundaryResolution({
        mode: "rep_patch",
        managerTerritoryId: "zone-1",
        managerZoneCandidates: [{ id: "zone-1", code: "ZONE-1", name: "Zone 1" }],
        clinicRecomputeEnqueued: true,
      })
    ).toEqual({
      success: true,
      mode: "rep_patch",
      managerTerritoryId: "zone-1",
      managerZoneCandidates: [{ id: "zone-1", code: "ZONE-1", name: "Zone 1" }],
      clinicRecomputeEnqueued: true,
    });
  });

  it("serializes manager zone resolution", () => {
    expect(
      serializeBoundaryResolution({
        mode: "manager_zone",
        repPatchCount: 3,
      })
    ).toEqual({
      success: true,
      mode: "manager_zone",
      repPatchCount: 3,
    });
  });

  it("serializes other-mode resolution", () => {
    expect(serializeBoundaryResolution({ mode: "other" })).toEqual({
      success: true,
      mode: "other",
    });
  });
});
