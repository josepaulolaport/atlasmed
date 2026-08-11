import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../test-utils/db-harness";
import { DrizzleClinicMembershipWriter } from "./drizzle-facility-membership.writer";

/**
 * Spec 0009 R6: derived manager-zone membership, recomputed as one statement.
 *
 * This has to be proved against Postgres. The rule — which profiles a boundary
 * change can affect, and which zone wins — used to live in TypeScript and is now
 * a single query using PostGIS coverage and the GiST index; a fake writer
 * asserting it would only be re-stating the fake (doctrine §11).
 *
 * What these cover:
 *
 *   1. a clinic inside the zone gains it (the derived link is created)
 *   2. shrinking the boundary away releases it — the profile is reachable
 *      *because* it still points at the territory, not because of geometry
 *   3. two same-vertical zones covering one clinic resolve to NULL and are
 *      reported as ambiguous, rather than disappearing silently (R4)
 *   4. a zone of a different vertical covering the same point changes nothing —
 *      different verticals may overlap freely (§1.2)
 *
 * Reference data is seeded, never assumed: no migration inserts
 * `territory_types` or `roles` (D-64), so reading them directly passes against a
 * production clone and fails in CI.
 *
 * Runs inside a transaction that is always rolled back.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

/** (10,10)–(11,11). The seeded clinic sits at its centre. */
const ZONE_SQUARE = {
  type: "Polygon" as const,
  coordinates: [[[10, 10], [10, 11], [11, 11], [11, 10], [10, 10]]],
};

/** Far from the clinic, so a recompute against it releases the membership. */
const ELSEWHERE_SQUARE = {
  type: "Polygon" as const,
  coordinates: [[[40, 40], [40, 41], [41, 41], [41, 40], [40, 40]]],
};

const CLINIC_LNG = 10.5;
const CLINIC_LAT = 10.5;

const one = async <T>(query: Promise<unknown>): Promise<T> =>
  ((await query) as T[])[0] as T;

async function managerZoneTypeId(tx: Tx): Promise<number> {
  const row = await one<{ id: number }>(
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
  return row.id;
}

async function createZone(
  tx: Tx,
  input: { slug: string; verticalId: number; typeId: number; boundary: object }
): Promise<number> {
  const row = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO territories (name, slug, code, territory_type_id, vertical_id, boundary)
      VALUES (${input.slug}, ${input.slug}, ${input.slug.toUpperCase()},
              ${input.typeId}, ${input.verticalId},
              ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.boundary)}), 4326))
      RETURNING id
    `)
  );
  return Number(row.id);
}

/** One clinic at the centre of ZONE_SQUARE, with an active profile and no zone. */
async function seedClinicInZone(tx: Tx) {
  const typeId = await managerZoneTypeId(tx);

  const vertical = await one<{ id: number }>(
    tx.execute(
      sql`INSERT INTO business_verticals (code, name) VALUES ('T-R6', 'T-R6') RETURNING id`
    )
  );
  const zoneId = await createZone(tx, {
    slug: "t-r6-zone",
    verticalId: Number(vertical.id),
    typeId,
    boundary: ZONE_SQUARE,
  });

  const state = await one<{ id: number }>(
    tx.execute(
      sql`INSERT INTO states (name, ibge_id, abbreviation) VALUES ('T-R6', '92', 'R6') RETURNING id`
    )
  );
  const municipality = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO municipalities (state_id, name, ibge_id)
      VALUES (${state.id}, 'T-R6 City', '9299999') RETURNING id
    `)
  );
  const facility = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facilities (name, legal_document_type, state_id, municipality_id, location)
      VALUES ('T-R6 Clinic', 'CNPJ', ${state.id}, ${municipality.id},
              ST_SetSRID(ST_MakePoint(${CLINIC_LNG}, ${CLINIC_LAT}), 4326))
      RETURNING id
    `)
  );
  const profile = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facility_vertical_profiles (facility_id, vertical_id, is_active)
      VALUES (${facility.id}, ${vertical.id}, true) RETURNING id
    `)
  );

  return {
    verticalId: Number(vertical.id),
    typeId,
    zoneId,
    facilityId: Number(facility.id),
    profileId: Number(profile.id),
  };
}

async function managerZoneIdOf(tx: Tx, profileId: number): Promise<number | null> {
  const rows = (await tx.execute(sql`
    SELECT manager_zone_id FROM facility_vertical_profiles WHERE id = ${profileId}
  `)) as Array<{ manager_zone_id: string | null }>;
  const value = rows[0]?.manager_zone_id;
  return value == null ? null : Number(value);
}

describe.skipIf(!dbUp)("manager zone membership recompute (database)", () => {
  test("a clinic inside the zone gains it", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedClinicInZone(tx);
      const writer = new DrizzleClinicMembershipWriter(tx as never);

      const result = await writer.recomputeManagerZoneMembership(seeded.zoneId);

      expect(await managerZoneIdOf(tx, seeded.profileId)).toBe(seeded.zoneId);
      expect(result.changed).toEqual([
        {
          facilityVerticalProfileId: seeded.profileId,
          facilityId: seeded.facilityId,
          managerZoneId: seeded.zoneId,
        },
      ]);
      expect(result.ambiguous).toEqual([]);
    });
  });

  test("shrinking the boundary away releases the membership", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedClinicInZone(tx);
      const writer = new DrizzleClinicMembershipWriter(tx as never);

      await writer.recomputeManagerZoneMembership(seeded.zoneId);
      expect(await managerZoneIdOf(tx, seeded.profileId)).toBe(seeded.zoneId);

      // The clinic is now outside. It is only reachable at all because the
      // profile still points at this territory — a bounding-box search around
      // the new geometry would never find it.
      await tx.execute(sql`
        UPDATE territories
        SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(ELSEWHERE_SQUARE)}), 4326)
        WHERE id = ${seeded.zoneId}
      `);

      const result = await writer.recomputeManagerZoneMembership(seeded.zoneId);

      expect(await managerZoneIdOf(tx, seeded.profileId)).toBeNull();
      expect(result.changed).toEqual([
        {
          facilityVerticalProfileId: seeded.profileId,
          facilityId: seeded.facilityId,
          managerZoneId: null,
        },
      ]);
    });
  });

  test("two same-vertical zones covering one clinic are ambiguous, not silent", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedClinicInZone(tx);
      const writer = new DrizzleClinicMembershipWriter(tx as never);

      // Inserted directly: I3 forbids this, so it cannot be produced through the
      // save path. R4 is about the state existing anyway and being reported.
      const overlapping = await createZone(tx, {
        slug: "t-r6-zone-overlap",
        verticalId: seeded.verticalId,
        typeId: seeded.typeId,
        boundary: ZONE_SQUARE,
      });

      const result = await writer.recomputeManagerZoneMembership(seeded.zoneId);

      expect(await managerZoneIdOf(tx, seeded.profileId)).toBeNull();
      expect(result.ambiguous).toHaveLength(1);
      expect(result.ambiguous[0]!.facilityId).toBe(seeded.facilityId);
      expect([...result.ambiguous[0]!.zoneIds].sort((a, b) => a - b)).toEqual(
        [seeded.zoneId, overlapping].sort((a, b) => a - b)
      );
    });
  });

  test("a zone of another vertical covering the same point changes nothing", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedClinicInZone(tx);
      const writer = new DrizzleClinicMembershipWriter(tx as never);

      const otherVertical = await one<{ id: number }>(
        tx.execute(
          sql`INSERT INTO business_verticals (code, name) VALUES ('T-R6B', 'T-R6B') RETURNING id`
        )
      );
      await createZone(tx, {
        slug: "t-r6-other-vertical",
        verticalId: Number(otherVertical.id),
        typeId: seeded.typeId,
        boundary: ZONE_SQUARE,
      });

      const result = await writer.recomputeManagerZoneMembership(seeded.zoneId);

      // §1.2: zones of different verticals may overlap freely, so the second
      // zone is not a competing match and the membership is unambiguous.
      expect(await managerZoneIdOf(tx, seeded.profileId)).toBe(seeded.zoneId);
      expect(result.ambiguous).toEqual([]);
    });
  });
});
