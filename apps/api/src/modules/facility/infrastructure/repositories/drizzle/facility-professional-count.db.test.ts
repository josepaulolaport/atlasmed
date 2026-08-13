import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleFacilityRepository } from "./drizzle-facility.repository";

/**
 * The "N médicos" on an Explorar card, against a real database.
 *
 * It read from a `Map` that was declared empty and never filled, so every
 * clinic in the list reported 0 while its detail page showed the real roster.
 * Nothing failed: the type was right, the default was sensible, and the number
 * was simply always zero.
 *
 * A fake repository cannot catch that — it would return whatever the fake was
 * told to. The assertion has to be against rows that exist.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-PROF-COUNT";
/**
 * Reserved for this suite. Real IBGE state codes are two digits and município
 * codes seven, so four and eight put these outside the space any other fixture
 * or the production data can reach.
 */
const STATE_IBGE = "9992";
const MUNICIPALITY_IBGE = "99920001";
const repository = new DrizzleFacilityRepository();

interface Fixture {
  facilityId: number;
  emptyFacilityId: number;
}

async function purge() {
  await db.execute(sql`
    delete from person_facility_classification_assignments
     where person_facility_id in (
       select pf.id from person_facilities pf
        join persons p on p.id = pf.person_id
       where p.last_name = ${MARK});
  `);
  await db.execute(sql`
    delete from person_facilities where person_id in (
      select id from persons where last_name = ${MARK});
  `);
  await db.execute(sql`
    delete from person_healthcare_profiles where person_id in (
      select id from persons where last_name = ${MARK});
  `);
  await db.execute(sql`delete from persons where last_name = ${MARK};`);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  // In `purge` rather than only at the end of the test that creates them: a run
  // that dies midway otherwise leaves a username behind that the next run
  // cannot insert past.
  await db.execute(sql`delete from users where username = ${MARK};`);
  await db.execute(sql`delete from roles where name = ${MARK};`);
  // Everything hanging off this suite's state, then the state. Matched by
  // abbreviation too, since it is unique and a row left by an earlier run would
  // otherwise absorb the insert in `seed`.
  await db.execute(sql`
    delete from municipalities
     where ibge_id = ${MUNICIPALITY_IBGE}
        or state_id in (
          select id from states
           where ibge_id = ${STATE_IBGE} or abbreviation = 'ZC'
        );
  `);
  await db.execute(
    sql`delete from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZC';`
  );
}

async function makeFacility(name: string): Promise<number> {
  await db.execute(sql`
    insert into facilities (name, location, legal_document_type, state_id, municipality_id)
      select ${name}, ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326), 'CNPJ', m.state_id, m.id
        from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE};
  `);
  const [row] = (await db.execute(sql`
    select id from facilities where name = ${name} limit 1;
  `)) as unknown as { id: number | string }[];
  if (!row) throw new Error("fixture facility was not created");
  return Number(row.id);
}

async function linkPerson(input: {
  firstName: string;
  facilityId: number;
  code: string;
}): Promise<void> {
  await db.execute(sql`
    insert into persons (first_name, last_name) values (${input.firstName}, ${MARK});
  `);
  const [person] = (await db.execute(sql`
    select id from persons where first_name = ${input.firstName} and last_name = ${MARK} limit 1;
  `)) as unknown as { id: number | string }[];
  const personId = Number(person!.id);
  await db.execute(sql`
    insert into person_healthcare_profiles (person_id) values (${personId});
  `);
  await db.execute(sql`
    insert into person_facilities (person_id, facility_id) values (${personId}, ${input.facilityId});
  `);
  await db.execute(sql`
    insert into person_facility_classification_assignments (person_facility_id, classification_id)
      select pf.id, c.id from person_facilities pf, person_facility_classifications c
       where pf.person_id = ${personId} and pf.facility_id = ${input.facilityId}
         and c.code = ${input.code};
  `);
}

async function seed(): Promise<Fixture> {
  /*
   * Its own state and município, always.
   *
   * Inserting only when the table was empty borrowed a real UF on a production
   * clone and claimed `ibge_id` 93 on a database migrated from empty — which
   * the territory suites insert unconditionally. Nothing deleted them, so the
   * collision outlived the run that caused it.
   */
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      values ('T-PROF UF', ${STATE_IBGE}, 'ZC') on conflict do nothing;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-PROF City', ${MUNICIPALITY_IBGE}
        from states s where s.ibge_id = ${STATE_IBGE}
      on conflict do nothing;
  `);

  const facilityId = await makeFacility(MARK);
  const emptyFacilityId = await makeFacility(`${MARK} VAZIA`);

  await linkPerson({
    firstName: "Clinico Um",
    facilityId,
    code: "HEALTHCARE_PROFESSIONAL",
  });
  await linkPerson({
    firstName: "Clinico Dois",
    facilityId,
    code: "HEALTHCARE_PROFESSIONAL",
  });
  // Counted by neither: a person_facilities row is not a clinical link, and
  // 211 active ones across the base are administrative contacts.
  await linkPerson({
    firstName: "Contato Administrativo",
    facilityId,
    code: "ADMINISTRATIVE_CONTACT",
  });

  return { facilityId, emptyFacilityId };
}

describe.if(dbUp)("facility list professional count", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  async function countFor(facilityId: number): Promise<number> {
    const { facilities } = await repository.findAll({
      page: 1,
      limit: 50,
      search: MARK,
      scope: { isGlobal: true, verticalIds: [] },
      userId: 1,
    } as never);
    const row = facilities.find((f) => f.id === facilityId);
    expect(row).toBeDefined();
    return row!.professionalCount;
  }

  it("counts the clinicians actually linked", async () => {
    expect(await countFor(fixture.facilityId)).toBe(2);
  });

  it("does not count an administrative contact as a doctor", async () => {
    // Otherwise a receptionist inflates a clinic's doctor count.
    expect(await countFor(fixture.facilityId)).toBe(2);
  });

  it("reports zero for a clinic with nobody linked", async () => {
    // The bug's disguise: 0 was also the right answer sometimes, which is why
    // a permanently-empty map looked plausible.
    expect(await countFor(fixture.emptyFacilityId)).toBe(0);
  });

  it("stops counting someone whose affiliation ended", async () => {
    /*
     * This suite's own user, created outright rather than borrowed.
     *
     * `person_facilities_ended_pair_check` pairs `ended_at` with
     * `ended_by_user_id`, so a null id fails the update — and the previous
     * version only inserted a user when the table was empty *and* a role
     * already existed, which is true on a production clone and false on a
     * database migrated from empty. It passed here and failed in CI.
     */
    await db.execute(sql`
      insert into roles (name, description)
        values (${MARK}, 'fixture role') on conflict do nothing;
    `);
    const [user] = (await db.execute(sql`
      insert into users (email, username, password_hash, role_id)
        select ${`${MARK}@example.test`}, ${MARK}, 'x', r.id
          from roles r where r.name = ${MARK}
        returning id;
    `)) as unknown as { id: number | string }[];
    if (!user) throw new Error("fixture user was not created");

    await db.execute(sql`
      update person_facilities set ended_at = now(),
             ended_by_user_id = ${Number(user.id)}
       where facility_id = ${fixture.facilityId}
         and person_id in (select id from persons
                            where first_name = 'Clinico Um' and last_name = ${MARK});
    `);

    expect(await countFor(fixture.facilityId)).toBe(1);

    /*
     * The user is cleaned up by `purge`, not here.
     *
     * `ended_by_user_id` is `on delete set null` while the check constraint
     * pairs it with `ended_at`, so deleting the user while the ended
     * affiliation still exists nulls one half of the pair and the constraint
     * refuses it. `purge` removes the people first, which takes the
     * affiliations with them.
     */
  });
});
