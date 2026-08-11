import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzleTerritorySpatialRepository } from "./drizzle-territory-spatial.repository";

/**
 * Spec 0009 R2's acceptance criterion, against real geometry: "an overridden
 * assignment survives a boundary edit that would otherwise de-assign it".
 *
 * The requirement's own words are the test — *an override that recompute can
 * erase is not an override*. So the same seeded clinic is checked twice, once
 * with the override set and once without, through every query that could take
 * the assignment away: the manager-zone impact set, the rep-patch impact set,
 * and the coverage delta for a proposed move.
 *
 * Runs inside a transaction that is always rolled back.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

const one = async <T>(query: Promise<unknown>): Promise<T> =>
  ((await query) as T[])[0] as T;

/** Covers the clinic today. */
const AREA = {
  type: "Polygon" as const,
  coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
};
/** Redrawn far away, so the clinic falls out of it. */
const AREA_MOVED = {
  type: "Polygon" as const,
  coordinates: [[[20, 20], [20, 21], [21, 21], [21, 20], [20, 20]]],
};

const CLINIC = { lng: 0.5, lat: 0.5 };
const ELSEWHERE = { lng: 40, lat: 40 };

let seq = 0;

async function seed(tx: Tx, typeSlug: "manager_zone" | "patch") {
  seq += 1;
  const tag = `T-OVR${seq}`;

  const type = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (SELECT id FROM territory_types WHERE slug = ${typeSlug}),
      created AS (
        INSERT INTO territory_types (slug, name, can_have_boundary, block_sibling_overlap)
        SELECT ${typeSlug}, ${typeSlug}, true, ${typeSlug === "manager_zone"}
        WHERE NOT EXISTS (SELECT 1 FROM existing) RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );
  const vertical = await one<{ id: number }>(
    tx.execute(sql`INSERT INTO business_verticals (code, name) VALUES (${tag}, ${tag}) RETURNING id`)
  );
  const territory = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO territories (name, slug, territory_type_id, vertical_id, boundary)
      VALUES (${tag}, ${tag.toLowerCase()}, ${type.id}, ${vertical.id},
              ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(AREA)}), 4326))
      RETURNING id
    `)
  );
  const role = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (SELECT id FROM roles ORDER BY id LIMIT 1), created AS (
        INSERT INTO roles (name) SELECT ${`${tag}-R`}
        WHERE NOT EXISTS (SELECT 1 FROM existing) RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );
  const user = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO users (email, username, password_hash, role_id, first_name, last_name)
      VALUES (${`${tag}@example.test`}, ${tag}, 'x', ${role.id}, 'Rep', ${tag}) RETURNING id
    `)
  );
  await tx.execute(sql`
    INSERT INTO user_territory_assignments (user_id, territory_id)
    VALUES (${user.id}, ${territory.id})
  `);

  const state = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO states (name, ibge_id, abbreviation)
      VALUES (${tag}, ${`6${seq}`}, ${`O${seq}`}) RETURNING id
    `)
  );
  const municipality = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO municipalities (state_id, name, ibge_id)
      VALUES (${state.id}, ${tag}, ${`61${seq}9999`}) RETURNING id
    `)
  );
  const facility = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facilities (name, legal_document_type, state_id, municipality_id, location)
      VALUES (${tag}, 'CNPJ', ${state.id}, ${municipality.id},
              ST_SetSRID(ST_MakePoint(${CLINIC.lng}, ${CLINIC.lat}), 4326))
      RETURNING id
    `)
  );
  const profile = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facility_vertical_profiles (facility_id, vertical_id, is_active, manager_zone_id)
      VALUES (${facility.id}, ${vertical.id}, true,
              ${typeSlug === "manager_zone" ? territory.id : null})
      RETURNING id
    `)
  );
  const assignment = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facility_vertical_rep_assignments (facility_vertical_profile_id, user_id)
      VALUES (${profile.id}, ${user.id}) RETURNING id
    `)
  );

  const setOverride = () =>
    tx.execute(sql`
      UPDATE facility_vertical_rep_assignments
      SET override_reason = 'Cliente histórico fora da área', override_by_user_id = ${user.id}
      WHERE id = ${assignment.id}
    `);

  return {
    territoryId: Number(territory.id),
    facilityId: Number(facility.id),
    setOverride,
  };
}

describe.skipIf(!dbUp)("overridden assignments survive recompute (database)", () => {
  test("manager-zone impact set: listed without an override, skipped with one", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx, "manager_zone");
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);
      const impact = () =>
        spatial.findAssignedClinicsImpactedByBoundary({
          territoryId: s.territoryId,
          mode: "manager_zone",
          geoJson: AREA_MOVED,
        });

      // Without the override the clinic is impacted — the redraw would end it.
      expect(await impact()).toHaveLength(1);

      await s.setOverride();

      // With it, the same redraw cannot touch the assignment.
      expect(await impact()).toEqual([]);
    });
  });

  test("rep-patch impact set: listed without an override, skipped with one", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx, "patch");
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);
      const impact = () =>
        spatial.findAssignedClinicsImpactedByBoundary({
          territoryId: s.territoryId,
          mode: "rep_patch",
          geoJson: AREA_MOVED,
        });

      expect(await impact()).toHaveLength(1);
      await s.setOverride();
      expect(await impact()).toEqual([]);
    });
  });

  test("coverage delta: a move cannot invalidate what was already off-patch on purpose", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx, "patch");
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);
      const delta = () =>
        spatial.findAssignmentsLosingPatchCoverage({
          facilityId: s.facilityId,
          ...ELSEWHERE,
        });

      expect(await delta()).toHaveLength(1);
      await s.setOverride();
      expect(await delta()).toEqual([]);
    });
  });
});
