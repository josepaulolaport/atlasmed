import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleFacilityRepository } from "./drizzle-facility.repository";

/**
 * Street-type abbreviations through the Postgres search fallback.
 *
 * The reported bug: a rep searched "Avenida das Americas", knowing the clinic
 * was on it, and got nothing. The registry writes "Av." — 436 of 1443 sampled
 * addresses begin with it and none begin with "Avenida" — and the fallback is a
 * single `ILIKE '%term%'`, so the typed expansion cannot match the contraction
 * stored on the row.
 *
 * Against rows rather than rendered SQL, because the thing worth proving is
 * which clinics come back. The Meilisearch half of the same fix is a `synonyms`
 * setting covered in the worker's `rebuild.test.ts`; this path is the one that
 * serves whenever the index lags or a filter is too large to send.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-ADDR-ABBREV";
const STATE_IBGE = "9994";
const MUNICIPALITY_IBGE = "99940001";
const repository = new DrizzleFacilityRepository();

interface Fixture {
  abbreviatedAvenue: number;
  spelledAvenue: number;
  abbreviatedStreet: number;
  accentedNeighborhood: number;
  unrelated: number;
}

async function purge() {
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(sql`
    delete from municipalities
     where ibge_id = ${MUNICIPALITY_IBGE}
        or state_id in (
          select id from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZE'
        );
  `);
  await db.execute(
    sql`delete from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZE';`
  );
}

async function makeFacility(input: {
  name: string;
  streetAddress: string | null;
  neighborhood?: string | null;
}): Promise<number> {
  await db.execute(sql`
    insert into facilities (name, location, street_address, neighborhood, legal_document_type, state_id, municipality_id)
      select ${input.name}, ST_SetSRID(ST_MakePoint(-43.3, -23.0), 4326),
             ${input.streetAddress}, ${input.neighborhood ?? null},
             'CNPJ'::facility_legal_document_type, m.state_id, m.id
        from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE};
  `);
  const [row] = (await db.execute(sql`
    select id from facilities where name = ${input.name} limit 1;
  `)) as unknown as { id: number | string }[];
  if (!row) throw new Error(`fixture facility ${input.name} was not created`);
  return Number(row.id);
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      values ('T-ADDR UF', ${STATE_IBGE}, 'ZE') on conflict do nothing;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-ADDR City', ${MUNICIPALITY_IBGE}
        from states s where s.ibge_id = ${STATE_IBGE}
      on conflict do nothing;
  `);

  return {
    // The shape the registry actually stores, and the row the rep could not find.
    abbreviatedAvenue: await makeFacility({
      name: `${MARK} CLINICA AV`,
      streetAddress: "Av. das Americas",
    }),
    // The rare spelled-out row, which already matched and must keep matching.
    spelledAvenue: await makeFacility({
      name: `${MARK} CLINICA AVENIDA`,
      streetAddress: "Rua Avenida Brasil",
    }),
    abbreviatedStreet: await makeFacility({
      name: `${MARK} CLINICA RUA`,
      streetAddress: "Rua Visconde de Piraja",
    }),
    // 319 of 1443 sampled addresses carry an accent and ILIKE does not fold
    // them, so the cedilla nobody types on a phone is its own miss.
    accentedNeighborhood: await makeFacility({
      name: `${MARK} CLINICA PRACA`,
      streetAddress: "Estrada do Bananal",
      neighborhood: "Praça Seca",
    }),
    unrelated: await makeFacility({
      name: `${MARK} CLINICA OUTRA`,
      streetAddress: "Alameda Santos",
      neighborhood: "Jardins",
    }),
  };
}

const globalScope = {
  isGlobal: true,
  facilityIds: [],
} as unknown as Parameters<typeof repository.findAll>[0]["scope"];

async function idsFor(search: string): Promise<number[]> {
  const { facilities } = await repository.findAll({
    page: 1,
    limit: 100,
    search,
    userId: 1,
    scope: globalScope,
  });
  return facilities.map((facility) => facility.id);
}

describe.if(dbUp)("address abbreviations in the SQL search fallback", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  it("finds the abbreviated address from the spelled-out term", async () => {
    // The exact report: "Avenida das Americas" returned nothing.
    const ids = await idsFor("Avenida das Americas");

    expect(ids).toContain(fixture.abbreviatedAvenue);
  });

  it("still finds the spelled-out address it always found", async () => {
    // The rewrite is added to the typed term, never substituted for it.
    const ids = await idsFor("Avenida Brasil");

    expect(ids).toContain(fixture.spelledAvenue);
  });

  it("expands in the other direction, from the contraction", async () => {
    // 676 sampled addresses begin "Rua"; a rep who types "R." must reach them.
    const ids = await idsFor("R. Visconde");

    expect(ids).toContain(fixture.abbreviatedStreet);
  });

  it("bridges the accent ILIKE will not fold", async () => {
    const ids = await idsFor("Praca Seca");

    expect(ids).toContain(fixture.accentedNeighborhood);
  });

  it("does not widen a term into unrelated clinics", async () => {
    // Expansion adds street-type spellings, not results. If "Avenida das
    // Americas" started matching an Alameda, the fix would be worse than the
    // bug — a rep cannot tell a wrong hit from a right one at a glance.
    const ids = await idsFor("Avenida das Americas");

    expect(ids).not.toContain(fixture.unrelated);
    expect(ids).not.toContain(fixture.abbreviatedStreet);
  });

  it("leaves a term with no street type alone", async () => {
    const ids = await idsFor("CLINICA OUTRA");

    expect(ids).toEqual([fixture.unrelated]);
  });
});
