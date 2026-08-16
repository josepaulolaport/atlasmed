import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import type { DashboardProfileFilter } from "../../application/dashboard-query";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";

/**
 * The território map draws the zones the filters left standing.
 *
 * It used to draw the linha's zones and nothing else, while the three numbers
 * printed directly under it — clínicas, médicos, cobertura — obeyed every
 * filter. Choosing Rio de Janeiro moved "1423 → 146 clínicas" and left the map
 * showing Amazonas and Pará. Both halves of one card, answering different
 * questions, with no way for a reader to tell which one they were looking at.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-TERR-FILTER";
const VERTICAL_CODE = "T_TERRF";
const NORTH = { stateIbge: "9991", municipalityIbge: "99910001", lng: -60, lat: -3 };
const SOUTH = { stateIbge: "9992", municipalityIbge: "99920001", lng: -43, lat: -23 };
const repository = new DrizzleDashboardRepository();

interface Fixture {
  verticalId: number;
  northStateId: number;
  southStateId: number;
  managerId: number;
  repId: number;
}

async function purge() {
  await db.execute(sql`
    delete from facility_vertical_profiles where facility_id in (
      select id from facilities where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(sql`
    delete from user_territory_assignments where territory_id in (
      select id from territories where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`delete from territories where name like ${`${MARK}%`};`);
  await db.execute(sql`delete from users where username like ${`${MARK}%`};`);
  await db.execute(sql`delete from territory_types where slug = ${`${MARK}-type`};`);
  await db.execute(
    sql`delete from business_verticals where code = ${VERTICAL_CODE};`,
  );
  await db.execute(sql`
    delete from municipalities
     where ibge_id in (${NORTH.municipalityIbge}, ${SOUTH.municipalityIbge})
        or state_id in (
          select id from states where ibge_id in (${NORTH.stateIbge}, ${SOUTH.stateIbge})
        );
  `);
  await db.execute(sql`
    delete from states where ibge_id in (${NORTH.stateIbge}, ${SOUTH.stateIbge});
  `);
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const [row] = (await db.execute(query)) as unknown as { id: number }[];
  if (!row) throw new Error("fixture row was not created");
  return Number(row.id);
}

async function seedPlace(
  place: typeof NORTH,
  name: string,
  abbreviation: string,
): Promise<number> {
  const stateId = await scalar(sql`
    insert into states (name, ibge_id, abbreviation)
      values (${`${MARK} ${name}`}, ${place.stateIbge}, ${abbreviation})
      returning id;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      values (${stateId}, ${`${MARK} ${name} City`}, ${place.municipalityIbge});
  `);
  return stateId;
}

/**
 * A square degree around the point, as the MultiPolygon the column requires.
 *
 * `ownerId` is not optional: the admin map draws a zone through its assignment,
 * so a zone seeded without one is invisible and a test that forgot it would
 * fail for a reason it never meant to assert.
 */
async function seedZone(
  place: typeof NORTH,
  name: string,
  verticalId: number,
  typeId: number,
  ownerId: number | null,
): Promise<void> {
  const territoryId = await scalar(sql`
    insert into territories (name, slug, territory_type_id, vertical_id, is_active, boundary)
      values (
        ${`${MARK} ${name}`}, ${`${MARK}-${name.toLowerCase()}`}, ${typeId}, ${verticalId}, true,
        ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint(${place.lng}, ${place.lat}), 4326), 1.0))
      )
      returning id;
  `);
  if (ownerId == null) return;
  await db.execute(sql`
    insert into user_territory_assignments (user_id, territory_id)
      values (${ownerId}, ${territoryId});
  `);
}

async function seedUser(role: string, handle: string): Promise<number> {
  // The roles table is empty on a freshly pushed test database, so the role is
  // created here rather than assumed. Left in place afterwards: it is reference
  // data every other fixture in this schema also expects to exist.
  await db.execute(sql`
    insert into roles (name) values (${role}) on conflict (name) do nothing;
  `);
  return scalar(sql`
    insert into users (email, username, password_hash, first_name, last_name, role_id, status)
      select ${`${handle}@t-terrf.test`}, ${`${MARK}-${handle}`}, 'x',
             ${MARK}, ${handle}, r.id, 'ACTIVE'::user_status
        from roles r where r.name = ${role}
      returning id;
  `);
}

async function seedClinic(
  place: typeof NORTH,
  name: string,
  cnes: string,
  verticalId: number,
): Promise<void> {
  const facilityId = await scalar(sql`
    insert into facilities (name, cnes_code, location, legal_document_type, state_id, municipality_id)
      select ${`${MARK} ${name}`}, ${cnes},
             ST_SetSRID(ST_MakePoint(${place.lng}, ${place.lat}), 4326),
             'CNPJ'::facility_legal_document_type, m.state_id, m.id
        from municipalities m where m.ibge_id = ${place.municipalityIbge}
      returning id;
  `);
  await db.execute(sql`
    insert into facility_vertical_profiles (facility_id, vertical_id, is_active)
      values (${facilityId}, ${verticalId}, true);
  `);
}

async function seed(): Promise<Fixture> {
  const northStateId = await seedPlace(NORTH, "Norte", "ZN");
  const southStateId = await seedPlace(SOUTH, "Sul", "ZS");

  const verticalId = await scalar(sql`
    insert into business_verticals (code, name)
      values (${VERTICAL_CODE}, 'T-TERRF Vertical') returning id;
  `);
  const typeId = await scalar(sql`
    insert into territory_types (slug, name) values (${`${MARK}-type`}, ${`${MARK} Zone`})
      returning id;
  `);

  const managerId = await seedUser("MANAGER", "gerente");
  const repId = await seedUser("REP", "representante");

  await seedZone(NORTH, "Norte", verticalId, typeId, managerId);
  await seedZone(SOUTH, "Sul", verticalId, typeId, managerId);
  // A rep patch inside the manager's northern zone, and a zone nobody holds.
  // Neither belongs on an unfiltered admin map: the patch would be drawn over
  // the zone containing it, and the orphan belongs to no one.
  await seedZone(NORTH, "Patch", verticalId, typeId, repId);
  await seedZone(SOUTH, "Orfa", verticalId, typeId, null);

  await seedClinic(NORTH, "CLINICA NORTE", "T9991001", verticalId);
  await seedClinic(SOUTH, "CLINICA SUL", "T9992001", verticalId);

  return { verticalId, northStateId, southStateId, managerId, repId };
}

describe.if(dbUp)("the território map follows the filters", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  const scope = (
    overrides: Partial<DashboardProfileFilter> = {},
  ): DashboardProfileFilter => ({
    verticalId: fixture.verticalId,
    zoneIds: null,
    repUserIds: null,
    stateIds: null,
    municipalityIds: null,
    unitTypeIds: null,
    ...overrides,
  });

  const zoneNames = async (
    filter: DashboardProfileFilter,
    ownerIds: number[] = [],
  ) => {
    const features = await repository.listVerticalTerritoryFeatures({
      verticalId: fixture.verticalId,
      filter,
      ownerIds,
    });
    return features.map((f) => f.name).sort();
  };

  it("draws the managers' zones when nothing is filtered", async () => {
    // Not every zone in the linha, which is what this used to be: the rep's
    // patch sits inside the northern zone and painted the same blue twice, and
    // the orphan belongs to nobody.
    expect(await zoneNames(scope())).toEqual([
      `${MARK} Norte`,
      `${MARK} Sul`,
    ]);
  });

  it("draws the chosen person's zones instead, at their granularity", async () => {
    expect(await zoneNames(scope(), [fixture.repId])).toEqual([
      `${MARK} Patch`,
    ]);
    expect(await zoneNames(scope(), [fixture.managerId])).toEqual([
      `${MARK} Norte`,
      `${MARK} Sul`,
    ]);
  });

  it("never draws a zone nobody is assigned to", async () => {
    // Seeded in the south with a clinic in scope, so only the missing
    // assignment keeps it off the map.
    const everyone = await zoneNames(scope(), [
      fixture.managerId,
      fixture.repId,
    ]);
    expect(everyone).not.toContain(`${MARK} Orfa`);
    expect(await zoneNames(scope())).not.toContain(`${MARK} Orfa`);
  });

  it("names the owner of each zone it draws", async () => {
    const [feature] = await repository.listVerticalTerritoryFeatures({
      verticalId: fixture.verticalId,
      filter: scope(),
      ownerIds: [fixture.repId],
    });

    expect(feature?.ownerId).toBe(fixture.repId);
    expect(feature?.ownerName).toBe(`${MARK} representante`);
  });

  it("drops the zone whose clinics the state filter excluded", async () => {
    // The defect in one assertion: this returned both zones, beside a clinic
    // count that had already dropped to the southern one.
    expect(await zoneNames(scope({ stateIds: [fixture.southStateId] }))).toEqual(
      [`${MARK} Sul`],
    );
    expect(await zoneNames(scope({ stateIds: [fixture.northStateId] }))).toEqual(
      [`${MARK} Norte`],
    );
  });

  it("draws nothing when the filters leave no clinic standing", async () => {
    // An empty map and "0 clínicas" agree. A full map over "0 clínicas" does
    // not, and that is what a reader had to reconcile before.
    expect(await zoneNames(scope({ municipalityIds: [-1] }))).toEqual([]);
  });

  it("keeps the geometry parsed, not the string ST_AsGeoJSON returns", async () => {
    const [feature] = await repository.listVerticalTerritoryFeatures({
      verticalId: fixture.verticalId,
      filter: scope({ stateIds: [fixture.southStateId] }),
      ownerIds: [],
    });

    expect(feature?.boundary).toBeTypeOf("object");
    expect((feature?.boundary as { type?: string }).type).toBe("MultiPolygon");
  });
});
