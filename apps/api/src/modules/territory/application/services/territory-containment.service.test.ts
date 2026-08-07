import { describe, expect, it, mock } from "bun:test";
import { TerritoryContainmentService } from "./territory-containment.service";
import { OperationNotAllowedError } from "../../../../shared/errors";

const polygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};

describe("TerritoryContainmentService", () => {
  it("resolves a single containing manager zone for a rep patch", async () => {
    const service = new TerritoryContainmentService({
      territoryRepository: {} as never,
      territoryTypeRepository: {} as never,
      spatialRepository: {
        findContainingManagerZones: mock(async () => [
          { id: 1, code: "ZONE-1", name: "Zone 1" },
        ]),
      } as never,
    });

    const resolution = await service.resolveRepPatchManagerZone(polygon);
    expect(resolution.managerTerritoryId).toBe(1);
  });

  it("rejects when no manager zone contains the patch", async () => {
    const service = new TerritoryContainmentService({
      territoryRepository: {} as never,
      territoryTypeRepository: {} as never,
      spatialRepository: {
        findContainingManagerZones: mock(async () => []),
      } as never,
    });

    await expect(service.resolveRepPatchManagerZone(polygon)).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  it("rejects when multiple manager zones contain the patch", async () => {
    const service = new TerritoryContainmentService({
      territoryRepository: {} as never,
      territoryTypeRepository: {} as never,
      spatialRepository: {
        findContainingManagerZones: mock(async () => [
          { id: 1, code: "ZONE-1", name: "Zone 1" },
          { id: 2, code: "ZONE-2", name: "Zone 2" },
        ]),
      } as never,
    });

    await expect(service.resolveRepPatchManagerZone(polygon)).rejects.toThrow(
      OperationNotAllowedError
    );
  });
});
