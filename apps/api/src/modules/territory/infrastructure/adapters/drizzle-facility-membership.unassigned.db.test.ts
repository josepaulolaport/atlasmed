import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../test-utils/db-harness";
import { DrizzleClinicMembershipWriter } from "./drizzle-facility-membership.writer";

/**
 * Spec 0009 R4's last third: the unassigned list distinguishes *why* a clinic is
 * waiting, and scopes each reason to whoever can act on it.
 *
 * The previous query returned only profiles that already had a manager zone, so
 * a clinic with none — contested by two zones, or covered by none — could never
 * appear. The one clinic most needing attention was the one nobody could see.
 *
 * What these prove against real geometry:
 *
 *   1. `no_consultant` — has a zone, no rep — reaches that zone's manager
 *   2. `ambiguous_zone` — two zones cover it — reaches **both** managers, so
 *      neither can assume the other owns it
 *   3. `no_zone` — nothing covers it — reaches only a global caller
 *   4. a manager sees none of another manager's clinics
 *   5. multi-vertical clinics keep both rows (the old code de-duplicated by
 *      facility id and silently dropped one)
 *   6. pagination and `total` come from SQL, not from slicing a full fetch
 *
 * Runs inside a transaction that is always rolled back.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

const one = async <T>(query: Promise<unknown>): Promise<T> =>
  ((await query) as T[])[0] as T;

/** Two overlapping squares, and a third far away. */
const ZONE_A = {
  type: "Polygon" as const,
  coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
};
const ZONE_B = {
  type: "Polygon" as const,
  coordinates: [[[0.5, 0], [0.5, 1], [1.5, 1], [1.5, 0], [0.5, 0]]],
};

let seq = 0;

async function seed(tx: Tx) {
  seq += 1;
  const tag = `T-UA${seq}`;

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
      sql`INSERT INTO business_verticals (code, name) VALUES (${tag}, ${tag}) RETURNING id`
    )
  );

  const createZone = async (slug: string, boundary: object, verticalId: number) =>
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

  const state = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO states (name, ibge_id, abbreviation)
      VALUES (${tag}, ${`8${seq}`}, ${`U${seq}`}) RETURNING id
    `)
  );
  const municipality = await one<{ id: number }>(
    tx.execute(sql`
      INSERT INTO municipalities (state_id, name, ibge_id)
      VALUES (${state.id}, ${tag}, ${`81${seq}9999`}) RETURNING id
    `)
  );

  /** A clinic with no active rep. `zoneId` null leaves membership underived. */
  const createClinic = async (input: {
    name: string;
    lng: number;
    lat: number;
    zoneId: number | null;
    verticalId: number;
  }) => {
    const facility = await one<{ id: number }>(
      tx.execute(sql`
        INSERT INTO facilities (name, legal_document_type, state_id, municipality_id, location)
        VALUES (${input.name}, 'CNPJ', ${state.id}, ${municipality.id},
                ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326))
        RETURNING id
      `)
    );
    const profile = await one<{ id: number }>(
      tx.execute(sql`
        INSERT INTO facility_vertical_profiles (facility_id, vertical_id, is_active, manager_zone_id)
        VALUES (${facility.id}, ${input.verticalId}, true, ${input.zoneId})
        RETURNING id
      `)
    );
    return { facilityId: Number(facility.id), profileId: Number(profile.id) };
  };

  return { zoneType: Number(zoneType.id), verticalId: Number(vertical.id), createZone, createClinic, tag, state, municipality };
}

describe.skipIf(!dbUp)("clinics needing a rep (database)", () => {
  test("no_consultant reaches the manager of the zone it sits in", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx);
      const zoneA = await s.createZone(`${s.tag}-A`, ZONE_A, s.verticalId);
      const clinic = await s.createClinic({
        name: "Com zona, sem rep",
        lng: 0.2,
        lat: 0.5,
        zoneId: zoneA,
        verticalId: s.verticalId,
      });

      const writer = new DrizzleClinicMembershipWriter(tx as never);
      const result = await writer.findClinicsNeedingRep({
        managerZoneIds: [zoneA],
        global: false,
        offset: 0,
        limit: 20,
      });

      const row = result.rows.find((r) => r.facilityId === clinic.facilityId);
      expect(row?.reason).toBe("no_consultant");
      expect(row?.managerZoneId).toBe(zoneA);
      expect(row?.candidateZoneIds).toEqual([]);
    });
  });

  test("ambiguous_zone reaches BOTH competing managers", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx);
      const zoneA = await s.createZone(`${s.tag}-A`, ZONE_A, s.verticalId);
      const zoneB = await s.createZone(`${s.tag}-B`, ZONE_B, s.verticalId);
      // Inside both. Membership is NULL because no single owner can be derived.
      const clinic = await s.createClinic({
        name: "Contestada",
        lng: 0.75,
        lat: 0.5,
        zoneId: null,
        verticalId: s.verticalId,
      });

      const writer = new DrizzleClinicMembershipWriter(tx as never);

      for (const zoneId of [zoneA, zoneB]) {
        const result = await writer.findClinicsNeedingRep({
          managerZoneIds: [zoneId],
          global: false,
          offset: 0,
          limit: 20,
        });
        const row = result.rows.find((r) => r.facilityId === clinic.facilityId);
        // Neither manager can assume the other owns it — that is the point.
        expect(row?.reason).toBe("ambiguous_zone");
        expect(row?.managerZoneId).toBeNull();
        expect([...row!.candidateZoneIds].sort((a, b) => a - b)).toEqual(
          [zoneA, zoneB].sort((a, b) => a - b)
        );
      }
    });
  });

  test("no_zone reaches a global caller only", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx);
      const zoneA = await s.createZone(`${s.tag}-A`, ZONE_A, s.verticalId);
      // Far outside every zone.
      const clinic = await s.createClinic({
        name: "Fora de tudo",
        lng: 40,
        lat: 40,
        zoneId: null,
        verticalId: s.verticalId,
      });

      const writer = new DrizzleClinicMembershipWriter(tx as never);

      const asManager = await writer.findClinicsNeedingRep({
        managerZoneIds: [zoneA],
        global: false,
        offset: 0,
        limit: 20,
      });
      expect(asManager.rows.find((r) => r.facilityId === clinic.facilityId)).toBeUndefined();

      const asAdmin = await writer.findClinicsNeedingRep({
        global: true,
        offset: 0,
        limit: 200,
      });
      const row = asAdmin.rows.find((r) => r.facilityId === clinic.facilityId);
      expect(row?.reason).toBe("no_zone");
      expect(row?.candidateZoneIds).toEqual([]);
    });
  });

  test("a manager does not see another manager's clinics", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx);
      const zoneA = await s.createZone(`${s.tag}-A`, ZONE_A, s.verticalId);
      const zoneFar = await s.createZone(
        `${s.tag}-FAR`,
        {
          type: "Polygon" as const,
          coordinates: [[[40, 40], [40, 41], [41, 41], [41, 40], [40, 40]]],
        },
        s.verticalId
      );
      const theirs = await s.createClinic({
        name: "Do outro gestor",
        lng: 40.5,
        lat: 40.5,
        zoneId: zoneFar,
        verticalId: s.verticalId,
      });

      const writer = new DrizzleClinicMembershipWriter(tx as never);
      const result = await writer.findClinicsNeedingRep({
        managerZoneIds: [zoneA],
        global: false,
        offset: 0,
        limit: 20,
      });

      expect(result.rows.find((r) => r.facilityId === theirs.facilityId)).toBeUndefined();
    });
  });

  test("a clinic needing a rep in two verticals keeps both rows", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx);
      const secondVertical = await one<{ id: number }>(
        tx.execute(sql`
          INSERT INTO business_verticals (code, name)
          VALUES (${`${s.tag}-V2`}, ${`${s.tag}-V2`}) RETURNING id
        `)
      );
      const zoneA = await s.createZone(`${s.tag}-A`, ZONE_A, s.verticalId);
      const zoneA2 = await s.createZone(
        `${s.tag}-A2`,
        ZONE_A,
        Number(secondVertical.id)
      );

      const clinic = await s.createClinic({
        name: "Duas verticais",
        lng: 0.2,
        lat: 0.5,
        zoneId: zoneA,
        verticalId: s.verticalId,
      });
      // Same facility, second vertical, also without a rep.
      await tx.execute(sql`
        INSERT INTO facility_vertical_profiles (facility_id, vertical_id, is_active, manager_zone_id)
        VALUES (${clinic.facilityId}, ${secondVertical.id}, true, ${zoneA2})
      `);

      const writer = new DrizzleClinicMembershipWriter(tx as never);
      const result = await writer.findClinicsNeedingRep({
        managerZoneIds: [zoneA, zoneA2],
        global: false,
        offset: 0,
        limit: 20,
      });

      // The old code de-duplicated by facility id and kept whichever row arrived
      // first, so one vertical's need silently vanished.
      const rows = result.rows.filter((r) => r.facilityId === clinic.facilityId);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.verticalId).sort()).toEqual(
        [s.verticalId, Number(secondVertical.id)].sort()
      );
    });
  });

  test("total counts every match, not just the page", async () => {
    await withRollback(async (tx) => {
      const s = await seed(tx);
      const zoneA = await s.createZone(`${s.tag}-A`, ZONE_A, s.verticalId);
      for (let i = 0; i < 3; i += 1) {
        await s.createClinic({
          name: `Sem rep ${i}`,
          lng: 0.2,
          lat: 0.5,
          zoneId: zoneA,
          verticalId: s.verticalId,
        });
      }

      const writer = new DrizzleClinicMembershipWriter(tx as never);
      const firstPage = await writer.findClinicsNeedingRep({
        managerZoneIds: [zoneA],
        global: false,
        offset: 0,
        limit: 2,
      });

      expect(firstPage.rows).toHaveLength(2);
      // Computed by count(*) OVER (), not by fetching everything and slicing.
      expect(firstPage.total).toBe(3);

      const secondPage = await writer.findClinicsNeedingRep({
        managerZoneIds: [zoneA],
        global: false,
        offset: 2,
        limit: 2,
      });
      expect(secondPage.rows).toHaveLength(1);
      expect(secondPage.total).toBe(3);
    });
  });

  test("a manager with no zones sees nothing", async () => {
    await withRollback(async (tx) => {
      const writer = new DrizzleClinicMembershipWriter(tx as never);
      const result = await writer.findClinicsNeedingRep({
        managerZoneIds: [],
        global: false,
        offset: 0,
        limit: 20,
      });
      expect(result).toEqual({ rows: [], total: 0 });
    });
  });
});
