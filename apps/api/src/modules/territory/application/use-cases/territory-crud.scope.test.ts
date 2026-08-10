import { describe, expect, it } from "bun:test";
import {
  ForbiddenError as AccessForbiddenError,
  createGlobalScopeContext,
  withTerritoryScopeAliases,
  type ScopeContext,
} from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import { TerritoryCrudUseCases } from "./territory-crud.use-cases";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "../services/territory-containment.service";

const PATCH_TYPE = {
  id: 2,
  slug: "patch",
  name: "Rep patch",
  description: null,
  canHaveBoundary: true,
  blockSiblingOverlap: true,
  isActive: true,
};

interface FakeTerritory {
  id: number;
  name: string;
  slug: string;
  code: string;
  verticalId: number;
  territoryTypeId: number;
  managerTerritoryId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function territory(id: number, verticalId: number): FakeTerritory {
  return {
    id,
    name: `T${id}`,
    slug: `t${id}`,
    code: `T${id}`,
    verticalId,
    territoryTypeId: PATCH_TYPE.id,
    managerTerritoryId: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function buildUseCases(territories: FakeTerritory[]) {
  const byId = new Map(territories.map((t) => [t.id, t]));

  const territoryRepository = {
    findAllActive: async (verticalId?: number) =>
      territories
        .filter((t) => !verticalId || t.verticalId === verticalId)
        .map((t) => ({ ...t, territoryType: PATCH_TYPE })),
    findById: async (id: number) => {
      const found = byId.get(id);
      return found ? { ...found, territoryType: PATCH_TYPE } : null;
    },
    countClinics: async () => 0,
    countAssignedUsers: async () => 0,
    countRepPatchesByManagerZone: async () => 0,
  } as unknown as TerritoryRepository;

  const territoryTypeRepository = {
    findById: async () => PATCH_TYPE,
    findBySlug: async () => PATCH_TYPE,
  } as unknown as TerritoryTypeRepository;

  const spatialRepository = {
    hasBoundary: async () => false,
  } as unknown as TerritorySpatialRepository;

  return new TerritoryCrudUseCases({
    territoryRepository,
    territoryTypeRepository,
    spatialRepository,
    containmentService: {} as TerritoryContainmentService,
  });
}

/** MANAGER assigned to territory 10, vertical 1 only. */
function managerScope(verticalIds: number[]): ScopeContext {
  return withTerritoryScopeAliases({
    isGlobal: false,
    assignedTerritoryIds: [10],
    effectiveTerritoryIds: [10, 11],
    analyticsEffectiveTerritoryIds: [],
    facilityIds: [],
    analyticsFacilityIds: [],
    managedUserIds: [],
    assignedVerticalIds: verticalIds,
    isOperationallyActive: true,
  });
}

describe("TerritoryCrudUseCases vertical/territory scope (spec 0010 §2.2)", () => {
  describe("createTerritory", () => {
    it("rejects a verticalId outside the caller's assignments", async () => {
      const useCases = buildUseCases([]);

      await expect(
        useCases.createTerritory({
          name: "Zona Sul",
          slug: "zona-sul",
          verticalId: 2,
          typeSlug: "patch",
          scope: managerScope([1]),
        })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects any verticalId when the caller has no vertical assignments", async () => {
      const useCases = buildUseCases([]);

      await expect(
        useCases.createTerritory({
          name: "Zona Sul",
          slug: "zona-sul",
          verticalId: 1,
          typeSlug: "patch",
          scope: managerScope([]),
        })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("does not narrow global (ADMIN) scope", async () => {
      const useCases = buildUseCases([]);

      // Passes the vertical guard and fails later on repository wiring,
      // proving the guard itself did not reject the admin.
      await expect(
        useCases.createTerritory({
          name: "Zona Sul",
          slug: "zona-sul",
          verticalId: 2,
          typeSlug: "patch",
          scope: createGlobalScopeContext(),
        })
      ).rejects.not.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("getTerritory", () => {
    it("rejects a territory outside the caller's territory scope", async () => {
      const useCases = buildUseCases([territory(99, 1)]);

      await expect(
        useCases.getTerritory(99, managerScope([1]))
      ).rejects.toBeInstanceOf(AccessForbiddenError);
    });

    it("returns a territory inside the caller's territory scope", async () => {
      const useCases = buildUseCases([territory(10, 1)]);

      const result = await useCases.getTerritory(10, managerScope([1]));
      expect(result?.id).toBe(10);
    });
  });

  describe("listTerritories", () => {
    it("rejects a verticalId filter outside the caller's assignments", async () => {
      const useCases = buildUseCases([territory(10, 1)]);

      await expect(
        useCases.listTerritories("flat", managerScope([1]), { verticalId: 2 })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("intersects results with assigned verticals when no filter is sent", async () => {
      const useCases = buildUseCases([territory(10, 1), territory(11, 2)]);

      const result = (await useCases.listTerritories(
        "flat",
        managerScope([1])
      )) as { data: Array<{ id: number }> };

      expect(result.data.map((t) => t.id)).toEqual([10]);
    });
  });
});
