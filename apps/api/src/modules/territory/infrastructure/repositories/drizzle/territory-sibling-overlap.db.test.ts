import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzleTerritorySpatialRepository } from "./drizzle-territory-spatial.repository";
import { DrizzleTerritoryTypeRepository } from "./drizzle-territory-type.repository";
import { DrizzleTerritoryRepository } from "./drizzle-territory.repository";
import { TerritoryContainmentService } from "../../../application/services/territory-containment.service";
import { GEO_SIBLING_OVERLAP_EPSILON_SQ_M } from "../../../application/constants/territory-geo.constants";
import { OperationNotAllowedError } from "../../../../../shared/errors";

/**
 * Spec 0009 R3 / invariant I3, against real PostGIS areas.
 *
 * The old rule was `overlapRatio > 0.05` — five percent of the *proposed*
 * polygon. On Sao Paulo (248,200 km²) that tolerated 12 km² of overlap between
 * two managers' zones; on a city-sized zone the same absolute sliver would have
 * been rejected. Area is the thing that matters, so area is what is measured.
 *
 * These assert the spec's acceptance criteria directly:
 *   - two same-vertical zones sharing a border save (they touch; no overlap)
 *   - a >100 m² overlap is rejected
 *   - float-scale overlap, below the epsilon, still saves
 *   - two *different*-vertical zones may overlap arbitrarily (§1.2)
 *
 * Reference data is seeded, not assumed — no migration inserts `territory_types`
 * (D-64), so reading it directly passes on a production clone and fails in CI.
 *
 * Runs inside a transaction that is always rolled back.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

const one = async <T>(query: Promise<unknown>): Promise<T> =>
  ((await query) as T[])[0] as T;

/** ~1.11 km on a side at the equator. */
function square(minLng: number, minLat: number, size: number) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [minLng, minLat],
        [minLng, minLat + size],
        [minLng + size, minLat + size],
        [minLng + size, minLat],
        [minLng, minLat],
      ],
    ],
  };
}

const SIZE = 0.01;
const EXISTING = square(0, 0, SIZE);
/** Shares the eastern border exactly — ST_Touches, never an overlap. */
const ADJACENT = square(SIZE, 0, SIZE);
/** Reaches 1e-5° (~1.11 m) back over the border: ~1200 m² of real overlap. */
const OVERLAPPING = square(SIZE - 0.00001, 0, SIZE);
/** Reaches 1e-9° (~0.11 mm) back: ~0.12 m², the scale of float noise. */
const SLIVER = square(SIZE - 0.000000001, 0, SIZE);

async function seedZonePair(tx: Tx) {
  const zoneType = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (
        SELECT id FROM territory_types WHERE slug = 'manager_zone'
      ), created AS (
        INSERT INTO territory_types (slug, name, can_have_boundary, block_sibling_overlap)
        SELECT 'manager_zone', 'Manager Zone', true, true
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );

  const vertical = await one<{ id: number }>(
    tx.execute(
      sql`INSERT INTO business_verticals (code, name) VALUES ('T-R3', 'T-R3') RETURNING id`
    )
  );
  const otherVertical = await one<{ id: number }>(
    tx.execute(
      sql`INSERT INTO business_verticals (code, name) VALUES ('T-R3B', 'T-R3B') RETURNING id`
    )
  );

  const createZone = async (slug: string, verticalId: number, boundary: object) =>
    Number(
      (
        await one<{ id: number }>(
          tx.execute(sql`
            INSERT INTO territories (name, slug, territory_type_id, vertical_id, boundary)
            VALUES (${slug}, ${slug}, ${zoneType.id}, ${verticalId},
                    ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}), 4326))
            RETURNING id
          `)
        )
      ).id
    );

  return {
    zoneTypeId: Number(zoneType.id),
    verticalId: Number(vertical.id),
    otherVerticalId: Number(otherVertical.id),
    // The zone already on the map, and the one being redrawn against it.
    existingZoneId: await createZone("t-r3-existing", Number(vertical.id), EXISTING),
    subjectZoneId: await createZone("t-r3-subject", Number(vertical.id), ADJACENT),
  };
}

describe.skipIf(!dbUp)("sibling overlap epsilon (database)", () => {
  test("a shared border produces no conflict at all", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedZonePair(tx);
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const conflicts = await spatial.findOverlappingSiblingTerritories({
        territoryId: seeded.subjectZoneId,
        territoryTypeId: seeded.zoneTypeId,
        geoJson: ADJACENT,
      });

      // ST_Touches is excluded by the query, so an exactly-shared border never
      // reaches the threshold. This is the case the editor's auto-clip produces.
      expect(conflicts).toEqual([]);
    });
  });

  test("a real overlap is measured in square metres, well above the epsilon", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedZonePair(tx);
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const conflicts = await spatial.findOverlappingSiblingTerritories({
        territoryId: seeded.subjectZoneId,
        territoryTypeId: seeded.zoneTypeId,
        geoJson: OVERLAPPING,
      });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.id).toBe(seeded.existingZoneId);
      // ~1.11 m over ~1110 m of shared border.
      expect(conflicts[0]!.overlapSquareMeters).toBeGreaterThan(100);
      // The spec's point: as a *ratio* of a 1.2 km² zone this is ~0.1% — far
      // under the old 5% rule, which would have let it through.
      expect(conflicts[0]!.overlapSquareMeters).toBeLessThan(2000);
    });
  });

  test("float-scale overlap stays below the epsilon", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedZonePair(tx);
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const conflicts = await spatial.findOverlappingSiblingTerritories({
        territoryId: seeded.subjectZoneId,
        territoryTypeId: seeded.zoneTypeId,
        geoJson: SLIVER,
      });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.overlapSquareMeters).toBeLessThan(
        GEO_SIBLING_OVERLAP_EPSILON_SQ_M
      );
    });
  });

  describe("through the containment service", () => {
    function buildService(tx: Tx) {
      return new TerritoryContainmentService({
        territoryRepository: new DrizzleTerritoryRepository(tx as never),
        territoryTypeRepository: new DrizzleTerritoryTypeRepository(tx as never),
        spatialRepository: new DrizzleTerritorySpatialRepository(tx as never),
      });
    }

    const subject = (seeded: Awaited<ReturnType<typeof seedZonePair>>) => ({
      id: seeded.subjectZoneId,
      territoryTypeId: seeded.zoneTypeId,
      verticalId: seeded.verticalId,
      territoryType: {
        id: seeded.zoneTypeId,
        slug: "manager_zone",
        name: "Manager Zone",
        canHaveBoundary: true,
        blockSiblingOverlap: true,
      },
    });

    test("a shared border saves", async () => {
      await withRollback(async (tx) => {
        const seeded = await seedZonePair(tx);
        await expect(
          buildService(tx).assertSiblingOverlapAllowed(
            subject(seeded) as never,
            ADJACENT
          )
        ).resolves.toBeUndefined();
      });
    });

    test("a real overlap is rejected, and the message says how much", async () => {
      await withRollback(async (tx) => {
        const seeded = await seedZonePair(tx);
        await expect(
          buildService(tx).assertSiblingOverlapAllowed(
            subject(seeded) as never,
            OVERLAPPING
          )
        ).rejects.toThrow(OperationNotAllowedError);

        // The operator has to be told which neighbour and by how much, or the
        // rejection is unactionable — they cannot see a 1 m sliver on the map.
        await buildService(tx)
          .assertSiblingOverlapAllowed(subject(seeded) as never, OVERLAPPING)
          .catch((error: Error) => {
            expect(error.message).toContain("t-r3-existing");
            expect(error.message).toMatch(/\d+ m²/);
          });
      });
    });

    test("float-scale overlap still saves", async () => {
      await withRollback(async (tx) => {
        const seeded = await seedZonePair(tx);
        await expect(
          buildService(tx).assertSiblingOverlapAllowed(subject(seeded) as never, SLIVER)
        ).resolves.toBeUndefined();
      });
    });

    test("zones of different verticals may overlap arbitrarily", async () => {
      await withRollback(async (tx) => {
        const seeded = await seedZonePair(tx);

        // Move the subject into the other vertical: §1.2 says zones of different
        // verticals overlap freely, and the query scopes by vertical to match.
        await tx.execute(sql`
          UPDATE territories SET vertical_id = ${seeded.otherVerticalId}
          WHERE id = ${seeded.subjectZoneId}
        `);

        await expect(
          buildService(tx).assertSiblingOverlapAllowed(
            { ...subject(seeded), verticalId: seeded.otherVerticalId } as never,
            OVERLAPPING
          )
        ).resolves.toBeUndefined();
      });
    });
  });
});
