import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleFacilityRepository } from "./drizzle-facility.repository";

/**
 * Setting a clinic's clinical focuses.
 *
 * Nothing in the app could do this: `facility_clinical_focuses` had exactly one
 * writer, the CNES importer, so a focus a rep was told about on site had
 * nowhere to go. The write is a replacement rather than add/remove because the
 * screen is a multiselect — the user's intent is "these are the focuses".
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-FOCUS-REPLACE";
const repository = new DrizzleFacilityRepository();

interface Fixture {
  facilityId: number;
  otherFacilityId: number;
  ortopedia: number;
  cardiologia: number;
  neurologia: number;
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const [row] = (await db.execute(query)) as unknown as { id: number }[];
  if (!row) throw new Error("fixture row was not created");
  return Number(row.id);
}

async function purge() {
  await db.execute(sql`
    delete from facility_clinical_focuses where facility_id in (
      select id from facilities where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`
    delete from facility_vertical_profiles where facility_id in (
      select id from facilities where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(
    sql`delete from clinical_focuses where name like ${`${MARK}%`};`,
  );
  await db.execute(sql`delete from municipalities where ibge_id = '99710001';`);
  await db.execute(sql`delete from states where ibge_id = '9971';`);
}

/**
 * Facilities are not-null on state and município, and a freshly pushed test
 * database carries neither, so the fixture creates its own rather than assuming
 * whatever another suite happened to leave behind.
 */
async function seedPlace(): Promise<number> {
  const stateId = await scalar(sql`
    insert into states (name, ibge_id, abbreviation)
      values (${`${MARK} Estado`}, '9971', 'ZF')
      on conflict (ibge_id) do update set name = excluded.name
      returning id;
  `);
  return scalar(sql`
    insert into municipalities (state_id, name, ibge_id)
      values (${stateId}, ${`${MARK} Cidade`}, '99710001')
      on conflict (ibge_id) do update set name = excluded.name
      returning id;
  `);
}

async function seedFacility(suffix: string, cnes: string): Promise<number> {
  return scalar(sql`
    insert into facilities (
      name, cnes_code, legal_document_type, location, state_id, municipality_id
    )
      select ${`${MARK} ${suffix}`}, ${cnes}, 'CNPJ'::facility_legal_document_type,
             ST_SetSRID(ST_MakePoint(-43.18, -22.95), 4326), m.state_id, m.id
        from municipalities m
       where m.ibge_id = '99710001' 
      returning id;
  `);
}

async function seedFocus(name: string): Promise<number> {
  return scalar(sql`
    insert into clinical_focuses (name) values (${`${MARK} ${name}`})
      returning id;
  `);
}

async function seed(): Promise<Fixture> {
  await seedPlace();
  return {
    facilityId: await seedFacility("Clinica", "T8880001"),
    otherFacilityId: await seedFacility("Outra", "T8880002"),
    ortopedia: await seedFocus("Ortopedia"),
    cardiologia: await seedFocus("Cardiologia"),
    neurologia: await seedFocus("Neurologia"),
  };
}

describe.if(dbUp)("replaceClinicalFocuses", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  const names = (list: { name: string }[]) => list.map((f) => f.name);

  it("writes the selection and returns the primary first", async () => {
    const result = await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [
        { id: fixture.ortopedia, isPrimary: false },
        { id: fixture.cardiologia, isPrimary: true },
      ],
    });

    // Cardiologia sorts before Ortopedia alphabetically anyway, so the order is
    // asserted again below on a pair where the two disagree.
    expect(names(result)).toEqual([
      `${MARK} Cardiologia`,
      `${MARK} Ortopedia`,
    ]);
    expect(result[0]?.isPrimary).toBe(true);
    expect(result[1]?.isPrimary).toBe(false);
  });

  it("puts the primary ahead of a name that sorts before it", async () => {
    const result = await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [
        { id: fixture.cardiologia, isPrimary: false },
        { id: fixture.ortopedia, isPrimary: true },
      ],
    });

    expect(names(result)).toEqual([
      `${MARK} Ortopedia`,
      `${MARK} Cardiologia`,
    ]);
  });

  it("replaces rather than adds", async () => {
    await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [{ id: fixture.neurologia, isPrimary: false }],
    });

    const result = await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [{ id: fixture.ortopedia, isPrimary: false }],
    });

    expect(names(result)).toEqual([`${MARK} Ortopedia`]);
  });

  it("moves the primary between focuses without tripping the unique index", async () => {
    // Delete-then-insert in one transaction is what makes this possible. An
    // implementation that inserted the new primary before clearing the old one
    // would violate facility_clinical_focuses_primary_uidx here.
    await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [
        { id: fixture.ortopedia, isPrimary: true },
        { id: fixture.cardiologia, isPrimary: false },
      ],
    });

    const moved = await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [
        { id: fixture.ortopedia, isPrimary: false },
        { id: fixture.cardiologia, isPrimary: true },
      ],
    });

    expect(moved.find((f) => f.isPrimary)?.name).toBe(`${MARK} Cardiologia`);
  });

  it("refuses two primaries rather than letting the database decide", async () => {
    await expect(
      repository.replaceClinicalFocuses({
        facilityId: fixture.facilityId,
        focuses: [
          { id: fixture.ortopedia, isPrimary: true },
          { id: fixture.cardiologia, isPrimary: true },
        ],
      }),
    ).rejects.toThrow();
  });

  it("clears the list when given nothing", async () => {
    await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [{ id: fixture.ortopedia, isPrimary: true }],
    });

    expect(
      await repository.replaceClinicalFocuses({
        facilityId: fixture.facilityId,
        focuses: [],
      }),
    ).toEqual([]);
  });

  it("leaves another clinic's focuses alone", async () => {
    await repository.replaceClinicalFocuses({
      facilityId: fixture.otherFacilityId,
      focuses: [{ id: fixture.neurologia, isPrimary: true }],
    });

    await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [],
    });

    const untouched = await repository.replaceClinicalFocuses({
      facilityId: fixture.otherFacilityId,
      focuses: [{ id: fixture.neurologia, isPrimary: true }],
    });
    expect(names(untouched)).toEqual([`${MARK} Neurologia`]);

    // And the primary index is per facility, not global: both clinics hold one
    // at the same time.
    const mine = await repository.replaceClinicalFocuses({
      facilityId: fixture.facilityId,
      focuses: [{ id: fixture.ortopedia, isPrimary: true }],
    });
    expect(mine[0]?.isPrimary).toBe(true);
  });
});
