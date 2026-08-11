import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzleTerritorySpatialRepository } from "./drizzle-territory-spatial.repository";

/**
 * Spec 0009 R5's coverage delta, against real geometry.
 *
 * The requirement is specific about what *not* to warn about: only assignments
 * that would actually become invalid. Warning because a clinic merely has a rep
 * produces alert fatigue and defeats the safety it buys — so an assignment whose
 * rep never covered the clinic (an override, or an already-broken state) must
 * stay silent when the pin moves, and an unaffected move must produce nothing.
 *
 * Runs inside a transaction that is always rolled back.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

const one = async <T>(query: Promise<unknown>): Promise<T> =>
  ((await query) as T[])[0] as T;

/** The rep's patch: (0,0)–(1,1). The clinic starts inside it. */
const PATCH = {
  type: "Polygon" as const,
  coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
};

const INSIDE = { lng: 0.5, lat: 0.5 };
/** Still inside the patch — a 50 m nudge must prompt nothing. */
const NEARBY_INSIDE = { lng: 0.5005, lat: 0.5 };
const OUTSIDE = { lng: 40, lat: 40 };

let seq = 0;

async function seed(tx: Tx, options: { repHasPatch: boolean }) {
  seq += 1;
  const tag = `T-CD${seq}`;

  const patchType = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (
        SELECT id FROM territory_types WHERE slug = 'patch'
      ), created AS (
        INSERT INTO territory_types (slug, name, can_have_boundary, block_sibling_overlap)
        SELECT 'patch', 'Patch', true, false
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );
  const vertical = await one<{ id: number }>(
    tx.execute(
      sql`INSERT INTO business_verticals (code, name) VALUES (${tag}, ${tag}) RETURNING id`
    )
  );
  const role = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (SELECT id FROM roles ORDER BY id LIMIT 1), created AS (
        INSERT INTO roles (name) SELECT ${`${tag}-ROLE`}
        WHERE NOT EXISTS (SELECT 1 FROM existing) RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );
  const user = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO users (email, username, password_hash, role_id, first_name, last_name)
      VALUES (${`${tag}@example.test`}, ${tag}, 'x', ${role.id}, 'Rep', ${tag})
      RETURNING id
    `)
  );

  if (options.repHasPatch) {
    const patch = await one<{ id: number }>(
      tx.execute(sql`
        INSERT INTO territories (name, slug, code, territory_type_id, vertical_id, boundary)
        VALUES (${tag}, ${tag}, ${tag}, ${patchType.id}, ${vertical.id},
                ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(PATCH)}), 4326))
        RETURNING id
      `)
    );
    await tx.execute(sql`
      INSERT INTO user_territory_assignments (user_id, territory_id)
      VALUES (${user.id}, ${patch.id})
    `);
  }

  const state = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO states (name, ibge_id, abbreviation)
      VALUES (${tag}, ${`7${seq}`}, ${`C${seq}`}) RETURNING id
    `)
  );
  const municipality = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO municipalities (state_id, name, ibge_id)
      VALUES (${state.id}, ${tag}, ${`71${seq}9999`}) RETURNING id
    `)
  );
  const facility = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facilities (name, legal_document_type, state_id, municipality_id, location)
      VALUES (${tag}, 'CNPJ', ${state.id}, ${municipality.id},
              ST_SetSRID(ST_MakePoint(${INSIDE.lng}, ${INSIDE.lat}), 4326))
      RETURNING id
    `)
  );
  const profile = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facility_vertical_profiles (facility_id, vertical_id, is_active)
      VALUES (${facility.id}, ${vertical.id}, true) RETURNING id
    `)
  );
  await tx.execute(sql`
    INSERT INTO facility_vertical_rep_assignments (facility_vertical_profile_id, user_id)
    VALUES (${profile.id}, ${user.id})
  `);

  return {
    facilityId: Number(facility.id),
    profileId: Number(profile.id),
    userId: Number(user.id),
  };
}

describe.skipIf(!dbUp)("coverage delta for a proposed move (database)", () => {
  test("moving out of the rep's patch reports that assignment", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx, { repHasPatch: true });
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const losing = await spatial.findAssignmentsLosingPatchCoverage({
        facilityId: s.facilityId,
        ...OUTSIDE,
      });

      expect(losing).toHaveLength(1);
      expect(losing[0]).toMatchObject({
        facilityVerticalProfileId: s.profileId,
        userId: s.userId,
      });
    });
  });

  test("moving within the patch reports nothing", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx, { repHasPatch: true });
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      // R5's acceptance criterion: a 50 m nudge inside the same patch prompts
      // nothing at all.
      const losing = await spatial.findAssignmentsLosingPatchCoverage({
        facilityId: s.facilityId,
        ...NEARBY_INSIDE,
      });

      expect(losing).toEqual([]);
    });
  });

  test("a rep who never covered the clinic is not newly warned about", async () => {
    await withRollback(async (tx) => {
      // No patch at all: this assignment is an override, or already invalid.
      // Either way the move does not *make* it invalid, so it must stay silent —
      // warning here every time a pin moves is exactly the alert fatigue R5
      // exists to avoid.
      const s = await seed(tx, { repHasPatch: false });
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const losing = await spatial.findAssignmentsLosingPatchCoverage({
        facilityId: s.facilityId,
        ...OUTSIDE,
      });

      expect(losing).toEqual([]);
    });
  });
});
