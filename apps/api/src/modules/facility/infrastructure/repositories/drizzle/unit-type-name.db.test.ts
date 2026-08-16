import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleFacilityRepository } from "./drizzle-facility.repository";

/**
 * The clinic header names the unit type under "Estabelecimento CNPJ".
 *
 * The detail payload carried `unitTypeId` and nothing else, so the only way to
 * show the words would have been for the client to hold the whole CNES unit
 * type catalogue and look the id up — which no clinic screen loads.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-UNITTYPE";
const repository = new DrizzleFacilityRepository();

interface Fixture {
  withType: number;
  withoutType: number;
  unitTypeName: string;
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const [row] = (await db.execute(query)) as unknown as { id: number }[];
  if (!row) throw new Error("fixture row was not created");
  return Number(row.id);
}

async function purge() {
  await db.execute(sql`
    delete from facility_vertical_profiles where facility_id in (
      select id from facilities where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(sql`delete from unit_types where name like ${`${MARK}%`};`);
  await db.execute(sql`delete from municipalities where ibge_id = '99720001';`);
  await db.execute(sql`delete from states where ibge_id = '9972';`);
}

async function seed(): Promise<Fixture> {
  const stateId = await scalar(sql`
    insert into states (name, ibge_id, abbreviation)
      values (${`${MARK} Estado`}, '9972', 'ZU')
      on conflict (ibge_id) do update set name = excluded.name
      returning id;
  `);
  const municipalityId = await scalar(sql`
    insert into municipalities (state_id, name, ibge_id)
      values (${stateId}, ${`${MARK} Cidade`}, '99720001')
      on conflict (ibge_id) do update set name = excluded.name
      returning id;
  `);
  const unitTypeName = `${MARK} Consultorio Isolado`;
  const unitTypeId = await scalar(sql`
    insert into unit_types (cnes_id, name) values ('9972', ${unitTypeName})
      returning id;
  `);

  const facility = async (suffix: string, cnes: string, typeId: number | null) =>
    scalar(sql`
      insert into facilities (
        name, cnes_code, legal_document_type, location, state_id,
        municipality_id, unit_type_id
      )
        values (
          ${`${MARK} ${suffix}`}, ${cnes},
          'CNPJ'::facility_legal_document_type,
          ST_SetSRID(ST_MakePoint(-43.18, -22.95), 4326),
          ${stateId}, ${municipalityId}, ${typeId}
        )
        returning id;
    `);

  return {
    withType: await facility("ComTipo", "T9972001", unitTypeId),
    withoutType: await facility("SemTipo", "T9972002", null),
    unitTypeName,
  };
}

describe.if(dbUp)("findById resolves the unit type's name", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  it("returns the name beside the id", async () => {
    const record = await repository.findById(fixture.withType);

    expect(record?.unitTypeName).toBe(fixture.unitTypeName);
    expect(record?.unitTypeId).toBeGreaterThan(0);
  });

  it("returns null when the clinic has no unit type", async () => {
    // Not an empty string: the header hides the line entirely, and "" would be
    // rendered as a blank row under the legal type.
    const record = await repository.findById(fixture.withoutType);

    expect(record?.unitTypeId).toBeNull();
    expect(record?.unitTypeName).toBeNull();
  });
});
