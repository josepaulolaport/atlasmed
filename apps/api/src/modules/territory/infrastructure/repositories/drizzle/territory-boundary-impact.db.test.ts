import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzleTerritorySpatialRepository } from "./drizzle-territory-spatial.repository";

/**
 * `findAssignedClinicsImpactedByBoundary`, executed against a real database.
 *
 * It had never been: every test of the two-phase preview/confirm flow substituted
 * a fake spatial repository, so the orchestration was proved and the SQL was not.
 * Both branches selected `f.display_name` — a column that has never existed. The
 * Drizzle field is `displayName`, but it maps to `name` (`facilities.ts:43`), and
 * raw SQL gets no such translation. Every call threw
 * `column f.display_name does not exist`, which means
 * `POST /territories/:id/boundary/impact` and `PUT /territories/:id/boundary`
 * were broken for every manager zone and rep patch.
 *
 * These run both branches end to end. A query that cannot execute fails here
 * regardless of what it selects, which is the property that was missing.
 *
 * Runs inside a transaction that is always rolled back.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

const one = async <T>(query: Promise<unknown>): Promise<T> =>
  ((await query) as T[])[0] as T;

/** The zone as it stands. The clinic sits inside it. */
const ZONE = {
  type: "Polygon" as const,
  coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
};

/** Redrawn to exclude the clinic — so the assigned rep is impacted. */
const ZONE_SHRUNK = {
  type: "Polygon" as const,
  coordinates: [[[10, 10], [10, 11], [11, 11], [11, 10], [10, 10]]],
};

const CLINIC_LNG = 0.5;
const CLINIC_LAT = 0.5;

async function seedAssignedClinic(tx: Tx, typeSlug: "manager_zone" | "patch") {
  const territoryType = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (
        SELECT id FROM territory_types WHERE slug = ${typeSlug}
      ), created AS (
        INSERT INTO territory_types (slug, name, can_have_boundary, block_sibling_overlap)
        SELECT ${typeSlug}, ${typeSlug}, true, ${typeSlug === "manager_zone"}
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );

  const vertical = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO business_verticals (code, name)
      VALUES (${`T-IMP-${typeSlug}`}, ${`T-IMP-${typeSlug}`}) RETURNING id
    `)
  );
  const territory = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO territories (name, slug, code, territory_type_id, vertical_id, boundary)
      VALUES (${`t-imp-${typeSlug}`}, ${`t-imp-${typeSlug}`}, ${`T-IMP-${typeSlug}`},
              ${territoryType.id}, ${vertical.id},
              ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(ZONE)}), 4326))
      RETURNING id
    `)
  );

  const state = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO states (name, ibge_id, abbreviation)
      VALUES (${`T-IMP-${typeSlug}`}, ${typeSlug === "patch" ? "93" : "94"},
              ${typeSlug === "patch" ? "IP" : "IM"}) RETURNING id
    `)
  );
  const municipality = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO municipalities (state_id, name, ibge_id)
      VALUES (${state.id}, 'T-IMP City', ${typeSlug === "patch" ? "9399999" : "9499999"})
      RETURNING id
    `)
  );
  const facility = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facilities (name, legal_document_type, state_id, municipality_id, location)
      VALUES ('Clinica Impactada', 'CNPJ', ${state.id}, ${municipality.id},
              ST_SetSRID(ST_MakePoint(${CLINIC_LNG}, ${CLINIC_LAT}), 4326))
      RETURNING id
    `)
  );
  const profile = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facility_vertical_profiles (facility_id, vertical_id, is_active, manager_zone_id)
      VALUES (${facility.id}, ${vertical.id}, true, ${territory.id}) RETURNING id
    `)
  );

  const role = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (
        SELECT id FROM roles ORDER BY id LIMIT 1
      ), created AS (
        INSERT INTO roles (name) SELECT 'T-IMP-ROLE'
        WHERE NOT EXISTS (SELECT 1 FROM existing) RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );
  const user = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO users (email, username, password_hash, role_id, first_name, last_name)
      VALUES (${`t-imp-${typeSlug}@example.test`}, ${`t-imp-${typeSlug}`}, 'x',
              ${role.id}, 'Rep', 'Impactado')
      RETURNING id
    `)
  );
  await tx.execute(sql`
    INSERT INTO facility_vertical_rep_assignments (facility_vertical_profile_id, user_id)
    VALUES (${profile.id}, ${user.id})
  `);

  // A rep patch reaches its rep through user_territory_assignments, not the profile.
  if (typeSlug === "patch") {
    await tx.execute(sql`
      INSERT INTO user_territory_assignments (user_id, territory_id)
      VALUES (${user.id}, ${territory.id})
    `);
  }

  return {
    territoryId: Number(territory.id),
    facilityId: Number(facility.id),
    profileId: Number(profile.id),
    userId: Number(user.id),
  };
}

describe.skipIf(!dbUp)("boundary impact query (database)", () => {
  test("manager zone: a clinic left outside surfaces with its rep", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedAssignedClinic(tx, "manager_zone");
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const impacted = await spatial.findAssignedClinicsImpactedByBoundary({
        territoryId: seeded.territoryId,
        mode: "manager_zone",
        geoJson: ZONE_SHRUNK,
      });

      expect(impacted).toEqual([
        {
          facilityId: seeded.facilityId,
          facilityName: "Clinica Impactada",
          facilityVerticalProfileId: seeded.profileId,
          consultantUserId: seeded.userId,
          consultantName: "Rep Impactado",
        },
      ]);
    });
  });

  test("manager zone: a clinic still inside is not impacted", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedAssignedClinic(tx, "manager_zone");
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const impacted = await spatial.findAssignedClinicsImpactedByBoundary({
        territoryId: seeded.territoryId,
        mode: "manager_zone",
        geoJson: ZONE,
      });

      expect(impacted).toEqual([]);
    });
  });

  test("rep patch: a clinic left outside surfaces with its rep", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedAssignedClinic(tx, "patch");
      const spatial = new DrizzleTerritorySpatialRepository(tx as never);

      const impacted = await spatial.findAssignedClinicsImpactedByBoundary({
        territoryId: seeded.territoryId,
        mode: "rep_patch",
        geoJson: ZONE_SHRUNK,
      });

      expect(impacted).toHaveLength(1);
      expect(impacted[0]).toMatchObject({
        facilityId: seeded.facilityId,
        facilityName: "Clinica Impactada",
        consultantUserId: seeded.userId,
      });
    });
  });
});
