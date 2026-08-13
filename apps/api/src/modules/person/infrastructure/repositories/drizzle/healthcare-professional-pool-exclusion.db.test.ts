import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleHealthcareProfessionalRepository } from "./drizzle-healthcare-professional.repository";

/**
 * `excludeFacilityId`, against a real database.
 *
 * The claim is specifically about *where* the exclusion happens — inside the
 * query, before `LIMIT`, rather than over the page the caller received. A fake
 * cannot show that: filtering a returned list and filtering a query produce the
 * same answer whenever the page is not full, which is every case except the one
 * that matters.
 *
 * So the fixture is built to make the difference visible: the excluded people
 * sort ahead of the candidates, and the page is smaller than the total. Filter
 * after `LIMIT` and the page comes back empty; filter inside the query and it
 * comes back full.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-POOL-EXCLUSION";
/**
 * Reserved for this suite. Real IBGE state codes are two digits and município
 * codes seven, so four and eight put these outside the space any other fixture
 * or the production data can reach.
 */
const STATE_IBGE = "9991";
const MUNICIPALITY_IBGE = "99910001";
const repository = new DrizzleHealthcareProfessionalRepository();

interface Fixture {
  facilityId: number;
  otherFacilityId: number;
}

async function purge() {
  await db.execute(sql`
    delete from person_facility_classification_assignments
     where person_facility_id in (
       select pf.id from person_facilities pf
        join persons p on p.id = pf.person_id
       where p.last_name = ${MARK}
     );
  `);
  await db.execute(sql`
    delete from person_facilities where person_id in (
      select id from persons where last_name = ${MARK}
    );
  `);
  await db.execute(sql`
    delete from person_healthcare_profiles where person_id in (
      select id from persons where last_name = ${MARK}
    );
  `);
  await db.execute(sql`delete from persons where last_name = ${MARK};`);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
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
           where ibge_id = ${STATE_IBGE} or abbreviation = 'ZP'
        );
  `);
  await db.execute(
    sql`delete from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZP';`
  );
}

/** Links a person to a facility under one classification code. */
async function link(personId: number, facilityId: number, code: string) {
  await db.execute(sql`
    insert into person_facilities (person_id, facility_id)
      values (${personId}, ${facilityId});
  `);
  await db.execute(sql`
    insert into person_facility_classification_assignments (person_facility_id, classification_id)
      select pf.id, c.id
        from person_facilities pf, person_facility_classifications c
       where pf.person_id = ${personId}
         and pf.facility_id = ${facilityId}
         and c.code = ${code};
  `);
}

async function makePerson(firstName: string): Promise<number> {
  await db.execute(sql`
    insert into persons (first_name, last_name) values (${firstName}, ${MARK});
  `);
  const [person] = (await db.execute(sql`
    select id from persons where first_name = ${firstName} and last_name = ${MARK} limit 1;
  `)) as unknown as { id: number }[];
  await db.execute(sql`
    insert into person_healthcare_profiles (person_id) values (${person!.id});
  `);
  return person!.id;
}

async function makeFacility(name: string): Promise<number> {
  await db.execute(sql`
    insert into facilities (name, location, legal_document_type, state_id, municipality_id)
      select ${name}, ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326), 'CNPJ', m.state_id, m.id
        from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE};
  `);
  const [facility] = (await db.execute(sql`
    select id from facilities where name = ${name} limit 1;
  `)) as unknown as { id: number }[];
  if (!facility) {
    throw new Error(
      "fixture facility was not created — is `municipalities` empty on this database?"
    );
  }
  return facility.id;
}

async function seed(): Promise<Fixture> {
  /*
   * Its own state and município, always.
   *
   * The previous version only inserted when the table was empty, which meant it
   * borrowed a real UF on a production clone and claimed `ibge_id` 91 on a
   * database migrated from empty — a value the territory suites also insert. It
   * never deleted them either, so the collision outlived the run that caused it.
   */
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      values ('T-POOL UF', ${STATE_IBGE}, 'ZP')
      on conflict do nothing;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-POOL City', ${MUNICIPALITY_IBGE}
        from states s where s.ibge_id = ${STATE_IBGE}
      on conflict do nothing;
  `);

  const facilityId = await makeFacility(MARK);
  const otherFacilityId = await makeFacility(`${MARK} OUTRA`);

  /**
   * Ordering is (last_name, first_name), and every one of these shares a last
   * name — so `first_name` alone decides who lands inside a short page. The two
   * already-associated doctors are named to sort first, which is what makes a
   * post-`LIMIT` filter observably wrong.
   */
  const associatedA = await makePerson("Aaa Associado Um");
  const associatedB = await makePerson("Aab Associado Dois");
  const candidateA = await makePerson("Zza Candidato Um");
  const candidateB = await makePerson("Zzb Candidato Dois");

  await link(associatedA, facilityId, "HEALTHCARE_PROFESSIONAL");
  await link(associatedB, facilityId, "HEALTHCARE_PROFESSIONAL");
  // A candidate who already works somewhere else is still a candidate here.
  await link(candidateA, otherFacilityId, "HEALTHCARE_PROFESSIONAL");

  return { facilityId, otherFacilityId };
}

describe.if(dbUp)("healthcare professional pool exclusion", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  it("fills the page with candidates instead of shortening it", async () => {
    // Two slots, and the two people who would have taken them are excluded.
    const { professionals, total } = await repository.findAll({
      page: 1,
      limit: 2,
      search: MARK,
      excludeFacilityId: fixture.facilityId,
      scope: { isGlobal: true },
    });

    expect(professionals.map((p) => p.firstName)).toEqual([
      "Zza Candidato Um",
      "Zzb Candidato Dois",
    ]);
    // The count query carries the same condition, so the client is never told
    // there are more candidates than it can reach.
    expect(total).toBe(2);
  });

  it("returns the excluded people when no exclusion is asked for", async () => {
    // Proves the fixture, not just the filter: without the parameter all four
    // are present and the associated pair takes the whole page.
    const { professionals, total } = await repository.findAll({
      page: 1,
      limit: 2,
      search: MARK,
      scope: { isGlobal: true },
    });

    expect(professionals.map((p) => p.firstName)).toEqual([
      "Aaa Associado Um",
      "Aab Associado Dois",
    ]);
    expect(total).toBe(4);
  });

  it("keeps someone linked here only as an administrative contact", async () => {
    /**
     * A `person_facilities` row is not a clinical link. This person is a contact
     * at the clinic and has never been associated as a doctor, so the sheet that
     * associates doctors must still offer them — and the CNES tab already does,
     * which is the disagreement an unscoped exclusion would create.
     */
    const contact = await makePerson("Zzc Contato Administrativo");
    await link(contact, fixture.facilityId, "ADMINISTRATIVE_CONTACT");

    const { professionals } = await repository.findAll({
      page: 1,
      limit: 10,
      search: MARK,
      excludeFacilityId: fixture.facilityId,
      scope: { isGlobal: true },
    });

    expect(professionals.map((p) => p.firstName)).toContain(
      "Zzc Contato Administrativo"
    );
  });

  it("stops excluding once the association has ended", async () => {
    // An ended link is history; the person is a candidate again.
    //
    // `ended_at` and `ended_by_user_id` are paired by a check constraint, so
    // ending one needs a real user — any user, since who ended it is not what
    // this asserts.
    /*
     * Created outright rather than borrowed. Inserting only when `users` was
     * empty *and* a role already existed is true on a production clone and
     * false on a database migrated from empty — so the id came back null there
     * and the paired check refused the update. It passed locally and failed in
     * CI.
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
      update person_facilities
         set ended_at = now(),
             ended_by_user_id = ${Number(user.id)}
       where facility_id = ${fixture.facilityId}
         and person_id in (
           select id from persons where first_name = 'Aaa Associado Um' and last_name = ${MARK}
         );
    `);

    const { professionals } = await repository.findAll({
      page: 1,
      limit: 10,
      search: MARK,
      excludeFacilityId: fixture.facilityId,
      scope: { isGlobal: true },
    });

    expect(professionals.map((p) => p.firstName)).toContain("Aaa Associado Um");
    expect(professionals.map((p) => p.firstName)).not.toContain(
      "Aab Associado Dois"
    );
  });
});
