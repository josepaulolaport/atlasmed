import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../test-utils/db-harness";
import { DrizzleTerritoryBoundaryWriter } from "./drizzle-territory-boundary.writer";

/**
 * Spec 0009 R1's acceptance criterion, against a real Postgres.
 *
 * R1 says the atomic boundary save must be "covered by an integration test".
 * Until now it was not: the only coverage asserted a rollback that the fake
 * writer's own `catch` performed, so it could not fail for the right reason, and
 * `DrizzleTerritoryBoundaryWriter` — the one file containing the transaction —
 * had none at all (D-68).
 *
 * What these prove that a fake cannot, against real rows:
 *
 *   1. **Order** — a rejected geometry never reaches the de-assignment at all.
 *      R1 asks for validate-then-destroy, which is stronger than destroying and
 *      rolling back: no row is locked on a change that may not be allowed.
 *   2. **Rollback** — when something fails *after* the de-assignment, Postgres
 *      restores it. Geometry can no longer get that far, so this uses the
 *      composite foreign key on `(manager_territory_id, vertical_id)`.
 *   3. The success path still ends the assignment and writes the geometry.
 *
 * If the destructive UPDATE ever escapes the transaction again — the original
 * D-01 — `ended_at` stays set and (2) fails.
 *
 * Runs inside a transaction that is always rolled back, so it seeds freely.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

/** A bowtie: two lobes crossing at the middle. ST_IsValid rejects it. */
const SELF_INTERSECTING = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 2],
      [0, 0],
    ],
  ],
};

const VALID_SQUARE = {
  type: "Polygon" as const,
  coordinates: [
    [
      [10, 10],
      [10, 11],
      [11, 11],
      [11, 10],
      [10, 10],
    ],
  ],
};

async function seedAssignedClinic(tx: Tx) {
  const one = async <T>(query: Promise<unknown>): Promise<T> =>
    ((await query) as T[])[0] as T;

  // Seed rather than assume. `territory_types` and `roles` are reference data
  // that no migration inserts (see D-64), so they are populated in production
  // and empty in a database migrated from scratch — which is exactly what CI
  // uses. Reading them directly passes locally against a production clone and
  // fails in CI, so the test brings its own.
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
      sql`INSERT INTO business_verticals (code, name) VALUES ('T-R1', 'T-R1') RETURNING id`
    )
  );
  const territory = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO territories (name, slug, code, territory_type_id, vertical_id, boundary)
      VALUES ('T-R1 Zone', 't-r1-zone', 'T-R1-ZONE', ${zoneType.id}, ${vertical.id},
              ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(VALID_SQUARE)}), 4326))
      RETURNING id
    `)
  );

  const state = await one<{ id: number }>(
    tx.execute(
      sql`INSERT INTO states (name, ibge_id, abbreviation) VALUES ('T-R1', '91', 'R1') RETURNING id`
    )
  );
  const municipality = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO municipalities (state_id, name, ibge_id)
      VALUES (${state.id}, 'T-R1 City', '9199999') RETURNING id
    `)
  );
  const facility = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facilities (name, legal_document_type, state_id, municipality_id)
      VALUES ('T-R1 Clinic', 'CNPJ', ${state.id}, ${municipality.id}) RETURNING id
    `)
  );
  const profile = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facility_vertical_profiles (facility_id, vertical_id)
      VALUES (${facility.id}, ${vertical.id}) RETURNING id
    `)
  );

  const role = await one<{ id: number }>(
    tx.execute(sql`
      WITH existing AS (
        SELECT id FROM roles ORDER BY id LIMIT 1
      ), created AS (
        INSERT INTO roles (name)
        SELECT 'T-R1-ROLE'
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id
      )
      SELECT id FROM existing UNION ALL SELECT id FROM created
    `)
  );
  const user = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO users (email, username, password_hash, role_id)
      VALUES ('t-r1@example.test', 't-r1', 'x', ${role.id}) RETURNING id
    `)
  );
  const assignment = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO facility_vertical_rep_assignments (facility_vertical_profile_id, user_id)
      VALUES (${profile.id}, ${user.id}) RETURNING id
    `)
  );

  return { territoryId: territory.id, profileId: profile.id, assignmentId: assignment.id };
}

async function assignmentEndedAt(tx: Tx, assignmentId: number) {
  const rows = (await tx.execute(sql`
    SELECT ended_at FROM facility_vertical_rep_assignments WHERE id = ${assignmentId}
  `)) as Array<{ ended_at: Date | null }>;
  return rows[0]?.ended_at ?? null;
}

describe.skipIf(!dbUp)("boundary save atomicity (database)", () => {
  test("invalid geometry never reaches the de-assignment", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedAssignedClinic(tx);
      const writer = new DrizzleTerritoryBoundaryWriter(tx as never);

      await expect(
        writer.commitBoundaryChange({
          territoryId: seeded.territoryId,
          boundary: SELF_INTERSECTING,
          endAssignmentsForProfileIds: [seeded.profileId],
          endReason: "boundary_impact",
          repairInvalid: false,
          countRepPatches: true,
        })
      ).rejects.toThrow();

      // R1's order: validate, then destroy. The rep was never de-assigned at
      // all, which is stronger than de-assigning and rolling back. I5 — rows are
      // never deleted, so a wrongly-ended one cannot be restored by recreating it.
      expect(await assignmentEndedAt(tx, seeded.assignmentId)).toBeNull();
    });
  });

  /**
   * The rollback itself, on a failure that happens *after* the de-assignment.
   *
   * Geometry errors can no longer get that far, so this uses the composite
   * foreign key on `(manager_territory_id, vertical_id)`: a manager territory
   * that does not exist is rejected by Postgres once the assignments are
   * already ended. If the destructive UPDATE ever escapes the transaction
   * again — the original D-01 — `ended_at` stays set and this fails.
   */
  test("a failure after de-assignment rolls it back", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedAssignedClinic(tx);
      const writer = new DrizzleTerritoryBoundaryWriter(tx as never);

      await expect(
        writer.commitBoundaryChange({
          territoryId: seeded.territoryId,
          boundary: VALID_SQUARE,
          endAssignmentsForProfileIds: [seeded.profileId],
          endReason: "boundary_impact",
          repairInvalid: false,
          managerTerritoryId: 2_000_000_000,
          countRepPatches: false,
        })
      ).rejects.toThrow();

      expect(await assignmentEndedAt(tx, seeded.assignmentId)).toBeNull();
    });
  });

  test("valid geometry ends the assignment and writes the boundary", async () => {
    await withRollback(async (tx) => {
      const seeded = await seedAssignedClinic(tx);
      const writer = new DrizzleTerritoryBoundaryWriter(tx as never);

      const result = await writer.commitBoundaryChange({
        territoryId: seeded.territoryId,
        boundary: {
          type: "Polygon",
          coordinates: [
            [
              [20, 20],
              [20, 21],
              [21, 21],
              [21, 20],
              [20, 20],
            ],
          ],
        },
        endAssignmentsForProfileIds: [seeded.profileId],
        endReason: "boundary_impact",
        repairInvalid: false,
        countRepPatches: true,
      });

      expect(result.endedAssignmentCount).toBe(1);
      expect(await assignmentEndedAt(tx, seeded.assignmentId)).not.toBeNull();

      const rows = (await tx.execute(sql`
        SELECT ST_X(ST_Centroid(boundary)) AS x FROM territories WHERE id = ${seeded.territoryId}
      `)) as Array<{ x: number }>;
      expect(Math.round(Number(rows[0]!.x))).toBe(21);
    });
  });
});
