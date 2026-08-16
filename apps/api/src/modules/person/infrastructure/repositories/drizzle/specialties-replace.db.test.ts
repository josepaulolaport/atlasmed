import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzlePersonRepository } from "./drizzle-person.repository";

/**
 * Setting a doctor's specialties.
 *
 * `person_healthcare_profile_specialties` had one writer, the CNES importer, so
 * a specialty the registry did not carry could not be recorded at all. The same
 * replacement shape as a clinic's clinical focuses, for the same reason: the
 * screen is a multiselect and the request carries the whole selection.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-SPEC-REPLACE";
const repository = new DrizzlePersonRepository();

interface Fixture {
  personId: number;
  withoutProfileId: number;
  ortopedia: number;
  cardiologia: number;
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const [row] = (await db.execute(query)) as unknown as { id: number }[];
  if (!row) throw new Error("fixture row was not created");
  return Number(row.id);
}

async function purge() {
  await db.execute(sql`
    delete from person_healthcare_profile_specialties where person_id in (
      select id from persons where first_name = ${MARK}
    );
  `);
  await db.execute(sql`
    delete from person_healthcare_profiles where person_id in (
      select id from persons where first_name = ${MARK}
    );
  `);
  await db.execute(sql`delete from persons where first_name = ${MARK};`);
  await db.execute(
    sql`delete from healthcare_specialties where name like ${`${MARK}%`};`,
  );
}

async function seedPerson(lastName: string, withProfile: boolean) {
  const personId = await scalar(sql`
    insert into persons (first_name, last_name) values (${MARK}, ${lastName})
      returning id;
  `);
  if (withProfile) {
    await db.execute(sql`
      insert into person_healthcare_profiles (person_id) values (${personId});
    `);
  }
  return personId;
}

async function seedSpecialty(name: string, cnesId: number): Promise<number> {
  return scalar(sql`
    insert into healthcare_specialties (name, cnes_id)
      values (${`${MARK} ${name}`}, ${cnesId})
      returning id;
  `);
}

async function seed(): Promise<Fixture> {
  return {
    personId: await seedPerson("ComPerfil", true),
    withoutProfileId: await seedPerson("SemPerfil", false),
    ortopedia: await seedSpecialty("Ortopedia", 998801),
    cardiologia: await seedSpecialty("Cardiologia", 998802),
  };
}

describe.if(dbUp)("replaceSpecialties", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  it("writes the selection with the primary first", async () => {
    const result = await repository.replaceSpecialties({
      personId: fixture.personId,
      specialties: [
        { id: fixture.cardiologia, isPrimary: false },
        { id: fixture.ortopedia, isPrimary: true },
      ],
    });

    // Ortopedia sorts after Cardiologia, so leading with it can only be the
    // primary ordering rather than the alphabetical one.
    expect(result.map((s) => s.name)).toEqual([
      `${MARK} Ortopedia`,
      `${MARK} Cardiologia`,
    ]);
    expect(result[0]?.isPrimary).toBe(true);
  });

  it("replaces rather than adds", async () => {
    const result = await repository.replaceSpecialties({
      personId: fixture.personId,
      specialties: [{ id: fixture.cardiologia, isPrimary: true }],
    });

    expect(result.map((s) => s.name)).toEqual([`${MARK} Cardiologia`]);
  });

  it("moves the primary without tripping the unique index", async () => {
    await repository.replaceSpecialties({
      personId: fixture.personId,
      specialties: [
        { id: fixture.ortopedia, isPrimary: true },
        { id: fixture.cardiologia, isPrimary: false },
      ],
    });

    const moved = await repository.replaceSpecialties({
      personId: fixture.personId,
      specialties: [
        { id: fixture.ortopedia, isPrimary: false },
        { id: fixture.cardiologia, isPrimary: true },
      ],
    });

    expect(moved.find((s) => s.isPrimary)?.name).toBe(`${MARK} Cardiologia`);
  });

  it("creates the healthcare profile a doctor does not have yet", async () => {
    // The join references person_healthcare_profiles. Without the upsert this
    // is a foreign key violation, and a doctor whose profile row was never
    // created could not be given a specialty at all.
    const result = await repository.replaceSpecialties({
      personId: fixture.withoutProfileId,
      specialties: [{ id: fixture.ortopedia, isPrimary: true }],
    });

    expect(result.map((s) => s.name)).toEqual([`${MARK} Ortopedia`]);
  });

  it("clears the list when given nothing", async () => {
    expect(
      await repository.replaceSpecialties({
        personId: fixture.personId,
        specialties: [],
      }),
    ).toEqual([]);
  });

  it("leaves another doctor's specialties alone", async () => {
    await repository.replaceSpecialties({
      personId: fixture.withoutProfileId,
      specialties: [{ id: fixture.cardiologia, isPrimary: true }],
    });
    await repository.replaceSpecialties({
      personId: fixture.personId,
      specialties: [{ id: fixture.ortopedia, isPrimary: true }],
    });

    const other = await repository.replaceSpecialties({
      personId: fixture.withoutProfileId,
      specialties: [{ id: fixture.cardiologia, isPrimary: true }],
    });
    expect(other.map((s) => s.name)).toEqual([`${MARK} Cardiologia`]);
  });
});
