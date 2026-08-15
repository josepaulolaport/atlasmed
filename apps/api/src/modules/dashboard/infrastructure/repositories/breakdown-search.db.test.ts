import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import type { DashboardProfileFilter } from "../../application/dashboard-query";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";

/**
 * Search inside a metric's breakdown.
 *
 * The breakdown had no search at all: the endpoint took `page` and `limit` and
 * nothing else, so a rep looking for one clinic in a list of 1423 scrolled. The
 * screen that did have a search box — the older drill-down — got it by calling
 * Explorar's `/facilities` instead, and that screen is unreachable.
 *
 * Search narrows the list, never the metric. The card above says how many
 * clinics are in the bucket, and that number must not move because somebody
 * typed into the list one tap below it.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-BREAKDOWN-SEARCH";
const STATE_IBGE = "9990";
const MUNICIPALITY_IBGE = "99900001";
const OTHER_MUNICIPALITY_IBGE = "99900002";
const VERTICAL_CODE = "T_BSRCH";
const repository = new DrizzleDashboardRepository();

interface Fixture {
  verticalId: number;
}

async function purge() {
  await db.execute(sql`
    delete from facility_vertical_profiles where facility_id in (
      select id from facilities where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(
    sql`delete from business_verticals where code = ${VERTICAL_CODE};`,
  );
  await db.execute(sql`
    delete from municipalities
     where ibge_id in (${MUNICIPALITY_IBGE}, ${OTHER_MUNICIPALITY_IBGE})
        or state_id in (select id from states where ibge_id = ${STATE_IBGE});
  `);
  await db.execute(sql`delete from states where ibge_id = ${STATE_IBGE};`);
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const [row] = (await db.execute(query)) as unknown as { id: number }[];
  if (!row) throw new Error("fixture row was not created");
  return Number(row.id);
}

async function seedClinic(input: {
  name: string;
  cnes: string;
  neighborhood: string;
  municipalityIbge: string;
  verticalId: number;
}): Promise<void> {
  const facilityId = await scalar(sql`
    insert into facilities (name, cnes_code, neighborhood, location, legal_document_type, state_id, municipality_id)
      select ${input.name}, ${input.cnes}, ${input.neighborhood},
             ST_SetSRID(ST_MakePoint(-43.2, -22.9), 4326),
             'CNPJ'::facility_legal_document_type, m.state_id, m.id
        from municipalities m where m.ibge_id = ${input.municipalityIbge}
      returning id;
  `);
  await db.execute(sql`
    insert into facility_vertical_profiles (facility_id, vertical_id, is_active)
      values (${facilityId}, ${input.verticalId}, true);
  `);
}

async function seed(): Promise<Fixture> {
  const stateId = await scalar(sql`
    insert into states (name, ibge_id, abbreviation)
      values (${`${MARK} UF`}, ${STATE_IBGE}, 'ZB') returning id;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      values (${stateId}, ${`${MARK} Niteroi`}, ${MUNICIPALITY_IBGE}),
             (${stateId}, ${`${MARK} Petropolis`}, ${OTHER_MUNICIPALITY_IBGE});
  `);

  const verticalId = await scalar(sql`
    insert into business_verticals (code, name)
      values (${VERTICAL_CODE}, 'T-BSRCH Vertical') returning id;
  `);

  await seedClinic({
    name: `${MARK} Ortopedia Central`,
    cnes: "T9990001",
    neighborhood: "Icarai",
    municipalityIbge: MUNICIPALITY_IBGE,
    verticalId,
  });
  await seedClinic({
    name: `${MARK} Clinica do Joelho`,
    cnes: "T9990002",
    neighborhood: "Centro",
    municipalityIbge: MUNICIPALITY_IBGE,
    verticalId,
  });
  await seedClinic({
    name: `${MARK} Traumato Serra`,
    cnes: "T9990003",
    neighborhood: "Valparaiso",
    municipalityIbge: OTHER_MUNICIPALITY_IBGE,
    verticalId,
  });

  return { verticalId };
}

describe.if(dbUp)("searching inside a metric breakdown", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  const scope = (): DashboardProfileFilter => ({
    verticalId: fixture.verticalId,
    zoneIds: null,
    repUserIds: null,
    stateIds: null,
    municipalityIds: null,
    unitTypeIds: null,
  });

  const list = (search?: string) =>
    repository.listScopedClinics({
      filter: scope(),
      search,
      offset: 0,
      limit: 50,
    });

  it("returns the whole scope when nothing is typed", async () => {
    const { rows, total } = await list();

    expect(total).toBe(3);
    expect(rows).toHaveLength(3);
  });

  it("matches on the clinic's name", async () => {
    const { rows, total } = await list("joelho");

    expect(total).toBe(1);
    expect(rows[0]?.name).toBe(`${MARK} Clinica do Joelho`);
  });

  it("matches on the neighbourhood", async () => {
    // A rep searching "Icarai" is looking for a place, not a name.
    const { rows } = await list("icarai");

    expect(rows.map((row) => row.name)).toEqual([
      `${MARK} Ortopedia Central`,
    ]);
  });

  it("matches on the city", async () => {
    const { rows } = await list("petropolis");

    expect(rows.map((row) => row.name)).toEqual([`${MARK} Traumato Serra`]);
  });

  it("counts what it found, not what the page held", async () => {
    // `total` drives the header and the infinite scroll's stopping point; if it
    // stayed at the unfiltered 3 the list would keep asking for pages that do
    // not exist.
    const { total } = await list(`${MARK}`);

    expect(total).toBe(3);
    expect((await list("joelho")).total).toBe(1);
  });

  it("says nothing matched rather than falling back to everything", async () => {
    const { rows, total } = await list("nao-existe-nenhuma");

    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it("leaves the metric's own count untouched", async () => {
    // The card above the list is the metric. Typing into the list is a question
    // about the list.
    expect(await repository.countProfiles(scope())).toBe(3);
  });

  it("ignores surrounding whitespace rather than searching for it", async () => {
    expect((await list("  joelho  ")).total).toBe(1);
    // An all-whitespace box is an empty box.
    expect((await list("   ")).total).toBe(3);
  });
});
