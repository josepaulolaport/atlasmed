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

/** Boundary-less type, so create tests exercise the guard, not PostGIS wiring. */
const FLAT_TYPE = { ...PATCH_TYPE, canHaveBoundary: false };

function buildUseCases(
  territories: FakeTerritory[],
  options?: {
    onCreate?: (row: { verticalId: number }) => void;
    /** Territory ids that have geometry; everything else has none. */
    boundariesFor?: number[];
    boundaryCalls?: number[][];
  }
) {
  const byId = new Map(territories.map((t) => [t.id, t]));
  const type = options?.onCreate ? FLAT_TYPE : PATCH_TYPE;

  const territoryRepository = {
    findAllActive: async (verticalId?: number) =>
      territories
        .filter((t) => !verticalId || t.verticalId === verticalId)
        .map((t) => ({ ...t, territoryType: type })),
    findById: async (id: number) => {
      const found = byId.get(id);
      return found ? { ...found, territoryType: type } : null;
    },
    findBySlug: async () => null,
    create: async (row: { verticalId: number }) => {
      options?.onCreate?.({ verticalId: row.verticalId });
      const created = { ...territory(500, row.verticalId), territoryTypeId: type.id };
      byId.set(created.id, created);
      return { ...created, territoryType: type };
    },
    countClinics: async () => 0,
    countAssignedUsers: async () => 0,
    countRepPatchesByManagerZone: async () => 0,
  } as unknown as TerritoryRepository;

  const territoryTypeRepository = {
    findById: async () => type,
    findBySlug: async () => type,
  } as unknown as TerritoryTypeRepository;

  const spatialRepository = {
    hasBoundary: async () => false,
    getBoundariesAsGeoJson: async (ids: number[]) => {
      options?.boundaryCalls?.push(ids);
      const withGeometry = options?.boundariesFor ?? [];
      return new Map(
        ids
          .filter((id) => withGeometry.includes(id))
          .map((id) => [
            id,
            { type: "Polygon" as const, coordinates: [[[id, 0]]] },
          ])
      );
    },
  } as unknown as TerritorySpatialRepository;

  return new TerritoryCrudUseCases({
    territoryRepository,
    territoryTypeRepository,
    spatialRepository,
    containmentService: {} as TerritoryContainmentService,
    // Spec 0009 R1: creation runs inside the transaction port. The fake hands
    // back the same repositories, so these scope tests still exercise the real
    // ordering without needing a database.
    transactionPort: {
      run: async (fn: (deps: never) => Promise<unknown>) =>
        fn({
          territoryRepository,
          territoryTypeRepository,
          spatialRepository,
          boundaryWriter: {
            commitBoundaryChange: async () => ({
              endedAssignmentCount: 0,
              repPatchCount: 0,
            }),
          },
          lockTerritory: async () => true,
        } as never),
    } as never,
    buildContainmentService: () => ({}) as TerritoryContainmentService,
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
      const created: Array<{ verticalId: number }> = [];
      const useCases = buildUseCases([], {
        onCreate: (row) => created.push(row),
      });

      const result = await useCases.createTerritory({
        name: "Zona Sul",
        slug: "zona-sul",
        verticalId: 2,
        typeSlug: "patch",
        scope: createGlobalScopeContext(),
      });

      // Reaches persistence with the requested vertical intact.
      expect(created).toEqual([{ verticalId: 2 }]);
      expect(result.id).toBe(500);
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

    it("rejects a verticalId filter when the caller has no vertical assignments", async () => {
      const useCases = buildUseCases([territory(10, 1)]);

      await expect(
        useCases.listTerritories("flat", managerScope([]), { verticalId: 1 })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("falls back to territory scope when the caller has no vertical assignments", async () => {
      // Documented residual: with no UVA rows and no filter there is nothing to
      // intersect against, so only `effectiveTerritoryIds` narrows the list.
      // Emptying it here is a product change, not a hole closure — see report.
      const useCases = buildUseCases([territory(10, 1), territory(99, 2)]);

      const result = (await useCases.listTerritories(
        "flat",
        managerScope([])
      )) as { data: Array<{ id: number }> };

      expect(result.data.map((t) => t.id)).toEqual([10]);
    });
  });

  describe("listTerritories include=boundary", () => {
    it("embeds geometry for the whole page in one lookup", async () => {
      const boundaryCalls: number[][] = [];
      const useCases = buildUseCases([territory(10, 1), territory(11, 1)], {
        boundariesFor: [10, 11],
        boundaryCalls,
      });

      const result = (await useCases.listTerritories(
        "flat",
        createGlobalScopeContext(),
        undefined,
        { boundary: true }
      )) as { data: Array<{ id: number; boundary: unknown }> };

      // One batched call for the page, not one per territory — the whole point.
      expect(boundaryCalls).toEqual([[10, 11]]);
      expect(result.data.map((t) => t.boundary)).toEqual([
        { type: "Polygon", coordinates: [[[10, 0]]] },
        { type: "Polygon", coordinates: [[[11, 0]]] },
      ]);
    });

    it("keeps a territory that has no boundary, as an explicit null", async () => {
      // `territories.boundary` is nullable and `territory_types.can_have_boundary`
      // exists, so a territory without geometry is a supported state. Dropping it
      // from the list would hide a real row; reporting it as absent would read as
      // "not loaded".
      const useCases = buildUseCases([territory(10, 1), territory(11, 1)], {
        boundariesFor: [10],
      });

      const result = (await useCases.listTerritories(
        "flat",
        createGlobalScopeContext(),
        undefined,
        { boundary: true }
      )) as { data: Array<{ id: number; boundary: unknown }> };

      expect(result.data.map((t) => t.id)).toEqual([10, 11]);
      expect(result.data[1]?.boundary).toBeNull();
    });

    it("does not query geometry when the caller did not ask for it", async () => {
      const boundaryCalls: number[][] = [];
      const useCases = buildUseCases([territory(10, 1)], {
        boundariesFor: [10],
        boundaryCalls,
      });

      const result = (await useCases.listTerritories(
        "flat",
        createGlobalScopeContext()
      )) as { data: Array<Record<string, unknown>> };

      expect(boundaryCalls).toEqual([]);
      expect(result.data[0]).not.toHaveProperty("boundary");
    });
  });
});
