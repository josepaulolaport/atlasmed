import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import { ListCnesSuggestionsUseCase } from "./cnes-suggestion.use-cases";

/**
 * The CNES suggestion join, against a real database (spec 0012 AC 1–3).
 *
 * The claim is about a join that crosses two schemas on an identifier neither
 * side owns, and about a row being excluded because of a `person_facilities`
 * row. Neither survives a fake — the first version of this feature filtered
 * client-side precisely because nobody had proved the join worked.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-CNES-SUGGEST";
const CNES_CODE = "9990002";
const SUS_LINKED = "AAAA000000000001";
const SUS_FREE = "AAAA000000000002";
const SUS_UNKNOWN = "AAAA000000000003";
const SUS_ADMIN_ONLY = "AAAA000000000004";
/** Reachable only through the bridge: a person with no CNES identifier at all. */
const SUS_BRIDGED = "AAAA000000000005";
const COUNCIL = "71";

const useCase = new ListCnesSuggestionsUseCase();

interface Fixture {
  facilityId: number;
  linkedPersonId: number;
  freePersonId: number;
  adminOnlyPersonId: number;
  bridgedPersonId: number;
}

async function purge() {
  await db.execute(sql`
    delete from registry.facility_professional_occupations where facility_cnes_id = ${CNES_CODE};
  `);
  await db.execute(sql`
    delete from registry.facility_professionals where facility_cnes_id = ${CNES_CODE};
  `);
  await db.execute(sql`
    delete from registry.professional_registrations
     where professional_cnes_id in (${SUS_LINKED}, ${SUS_FREE}, ${SUS_UNKNOWN}, ${SUS_ADMIN_ONLY}, ${SUS_BRIDGED});
  `);
  await db.execute(sql`
    delete from registry.professionals
     where cnes_id in (${SUS_LINKED}, ${SUS_FREE}, ${SUS_UNKNOWN}, ${SUS_ADMIN_ONLY}, ${SUS_BRIDGED});
  `);
  await db.execute(sql`delete from registry.facilities where cnes_id = ${CNES_CODE};`);
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
  await db.execute(sql`delete from facilities where name = ${MARK};`);
  // Leaving these behind consumes a globally-unique ibge_id and abbreviation
  // for every later suite on the same database.
  await db.execute(
    sql`delete from municipalities where name = 'T-CNES-SUGGEST City';`
  );
  await db.execute(sql`delete from states where name = 'T-CNES-SUGGEST UF';`);
}

async function seed(): Promise<Fixture> {
  /**
   * A database migrated from empty has no states and no municipalities, and CI
   * is exactly that — the facility insert selected from an empty table, found
   * nothing, and the fixture then dereferenced a facility that was never
   * created. Reuse what exists, create only what is missing: `states` has a
   * two-character UNIQUE abbreviation, so inventing one per run would collide
   * on any database that already has the real 27.
   */
  /**
   * `ibge_id` and `abbreviation` are both UNIQUE, and these values must not
   * collide with another suite's fixture on a shared database. `'99'`/`'TT'`
   * belong to `facility-purchase-recurrence.db.test.ts`, and taking `'99'` here
   * made that suite fail — from a file that never mentions it.
   */
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      select 'T-CNES-SUGGEST UF', '90', 'ZQ'
       where not exists (select 1 from states);
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-CNES-SUGGEST City', '9000001'
        from states s
       where not exists (select 1 from municipalities)
       limit 1;
  `);

  await db.execute(sql`
    insert into facilities (name, location, legal_document_type, state_id, municipality_id, cnes_code)
      select ${MARK}, ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326), 'CNPJ', m.state_id, m.id, ${CNES_CODE}
        from municipalities m limit 1;
  `);
  const [facility] = (await db.execute(sql`
    select id from facilities where name = ${MARK} limit 1;
  `)) as unknown as { id: number }[];
  if (!facility) {
    // Fail with the cause rather than a null dereference three lines later.
    throw new Error(
      "fixture facility was not created — is `municipalities` empty on this database?"
    );
  }

  await db.execute(sql`
    insert into registry.facilities (cnes_id, atlasmed_id, trade_name)
      values (${CNES_CODE}, ${facility!.id}, ${MARK});
  `);

  const people: Record<string, number> = {};
  for (const [first, sus] of [
    ["Linked", SUS_LINKED],
    ["Free", SUS_FREE],
  ] as const) {
    await db.execute(sql`
      insert into persons (first_name, last_name) values (${first}, ${MARK});
    `);
    const [person] = (await db.execute(sql`
      select id from persons where first_name = ${first} and last_name = ${MARK} limit 1;
    `)) as unknown as { id: number }[];
    people[sus] = person!.id;
    await db.execute(sql`
      insert into person_healthcare_profiles (person_id, cnes_professional_id)
        values (${person!.id}, ${sus});
    `);
  }

  // Already linked at this clinic AS A CLINICIAN — must not be suggested (AC 2).
  await db.execute(sql`
    insert into person_facilities (person_id, facility_id)
      values (${people[SUS_LINKED]!}, ${facility!.id});
  `);
  await db.execute(sql`
    insert into person_facility_classification_assignments (person_facility_id, classification_id)
      select pf.id, c.id
        from person_facilities pf, person_facility_classifications c
       where pf.person_id = ${people[SUS_LINKED]!}
         and pf.facility_id = ${facility!.id}
         and c.code = 'HEALTHCARE_PROFESSIONAL';
  `);

  // Linked, but only as an administrative contact. Still a suggestion: the
  // "já associados" section is classification-scoped, so excluding this person
  // would hide them from the sheet entirely.
  await db.execute(sql`
    insert into persons (first_name, last_name) values ('AdminOnly', ${MARK});
  `);
  const [adminOnly] = (await db.execute(sql`
    select id from persons where first_name = 'AdminOnly' and last_name = ${MARK} limit 1;
  `)) as unknown as { id: number }[];
  await db.execute(sql`
    insert into person_healthcare_profiles (person_id, cnes_professional_id)
      values (${adminOnly!.id}, ${SUS_ADMIN_ONLY});
  `);
  await db.execute(sql`
    insert into person_facilities (person_id, facility_id)
      values (${adminOnly!.id}, ${facility!.id});
  `);
  await db.execute(sql`
    insert into person_facility_classification_assignments (person_facility_id, classification_id)
      select pf.id, c.id
        from person_facilities pf, person_facility_classifications c
       where pf.person_id = ${adminOnly!.id}
         and pf.facility_id = ${facility!.id}
         and c.code = 'ADMINISTRATIVE_CONTACT';
  `);

  /**
   * A doctor a rep entered by hand: no `cnes_professional_id`, so the SUS-id
   * join can never reach them. The loader's bridge is set below, which is the
   * only thing that makes them resolvable.
   */
  await db.execute(sql`
    insert into persons (first_name, last_name) values ('Bridged', ${MARK});
  `);
  const [bridged] = (await db.execute(sql`
    select id from persons where first_name = 'Bridged' and last_name = ${MARK} limit 1;
  `)) as unknown as { id: number }[];
  await db.execute(sql`
    insert into person_healthcare_profiles (person_id) values (${bridged!.id});
  `);

  for (const [sus, name] of [
    [SUS_LINKED, "DOUTOR LINKED"],
    [SUS_FREE, "DOUTOR FREE"],
    [SUS_ADMIN_ONLY, "DOUTOR ADMIN ONLY"],
    [SUS_BRIDGED, "DOUTOR BRIDGED"],
    // In the registry at this clinic, but no person on our side: not shown in
    // this pass (spec 0012 §5), because surfacing them means creating a person
    // from registry data, which is §6.
    [SUS_UNKNOWN, "DOUTOR DESCONHECIDO"],
  ] as const) {
    await db.execute(sql`
      insert into registry.professionals (cnes_id, full_name) values (${sus}, ${name});
    `);
    await db.execute(sql`
      insert into registry.facility_professionals (facility_cnes_id, professional_cnes_id)
        values (${CNES_CODE}, ${sus});
    `);
  }

  await db.execute(sql`
    insert into registry.professional_registrations
      (professional_cnes_id, council_cnes_id, state_code, registration_number)
    select ${SUS_FREE}, ${COUNCIL}, 'SP', '9987654'
     where exists (select 1 from registry.professional_councils where cnes_id = ${COUNCIL});
  `);

  // Coerced once, here. These come back from a bigint column as strings, and
  // leaving them that way is what let the serialisation bug through: assertions
  // compared string to string and agreed, while the client compared string to
  // number and threw.
  // What the loader's bridge step writes when a council registration matches.
  await db.execute(sql`
    update registry.professionals set atlasmed_id = ${bridged!.id}
     where cnes_id = ${SUS_BRIDGED};
  `);

  return {
    facilityId: Number(facility!.id),
    linkedPersonId: Number(people[SUS_LINKED]!),
    freePersonId: Number(people[SUS_FREE]!),
    adminOnlyPersonId: Number(adminOnly!.id),
    bridgedPersonId: Number(bridged!.id),
  };
}

describe.if(dbUp)("ListCnesSuggestionsUseCase", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(async () => {
    if (dbUp) await purge();
  });

  it("suggests the CNES colleague we hold but have not linked", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });

    expect(result.status).toBe("OK");
    const ids = result.items.map((i) => i.personId);
    expect(ids).toContain(fixture.freePersonId);
  });

  it("serialises personId as a number", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    /**
     * `persons.id` is bigint and the driver returns those as strings. The first
     * version shipped `"410"` under a type that said `number`; every test here
     * passed because the fixture ids were strings too, so both sides of the
     * comparison were wrong in the same way. The client threw on the cast.
     */
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(typeof item.personId).toBe("number");
    }
  });

  it("labels someone already linked rather than dropping them", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });

    const linked = result.items.find((i) => i.personId === fixture.linkedPersonId);
    /**
     * Returned, not filtered. The CNES tab answers "of the people CNES places
     * here, which do we already have" — coverage against this snapshot, which
     * our own roster cannot express. AC 2 still holds because the client keeps
     * these out of the suggestion section.
     */
    expect(linked).toBeDefined();
    expect(linked!.alreadyLinked).toBe(true);
  });

  it("marks a suggestible person as not linked", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    const free = result.items.find((i) => i.personId === fixture.freePersonId);
    expect(free!.alreadyLinked).toBe(false);
  });

  it("does not count an administrative-contact link as linked", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    const adminOnly = result.items.find(
      (i) => i.personId === fixture.adminOnlyPersonId
    );
    // They hold a person_facilities row, but not as a clinician — so they are
    // still someone a rep needs to associate.
    expect(adminOnly!.alreadyLinked).toBe(false);
  });

  it("resolves a person reachable only through the registration bridge", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    /**
     * This person has no `cnes_professional_id` — nobody types those — so the
     * SUS-id join cannot see them. Only `registry.professionals.atlasmed_id`,
     * written by the loader from a matching council registration, does.
     *
     * Without this, a doctor a rep entered last week comes back in next month's
     * export as somebody CNES knows and we do not, and the sheet offers to
     * import a person we already hold.
     */
    const bridgedRow = result.items.find(
      (i) => i.personId === fixture.bridgedPersonId
    );
    expect(bridgedRow).toBeDefined();
    expect(bridgedRow!.alreadyLinked).toBe(false);
  });

  it("omits registry people who do not exist on our side", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    // Five registry vínculos here; the one unknown to us under either route is
    // omitted, leaving four — one of them labelled as already linked.
    expect(result.items).toHaveLength(4);
    expect(result.items.filter((i) => !i.alreadyLinked)).toHaveLength(3);
  });

  it("reports the loaded competence so the UI can date the snapshot", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    // Null only when no run has ever promoted; either way it must not throw.
    if (result.reference !== null) {
      expect(result.reference).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("distinguishes a facility with no cnes_code from an empty result", async () => {
    await db.execute(sql`
      insert into facilities (name, location, legal_document_type, state_id, municipality_id)
        select ${MARK}, ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326), 'CNPJ', m.state_id, m.id
          from municipalities m limit 1;
    `);
    const [plain] = (await db.execute(sql`
      select id from facilities where name = ${MARK} and cnes_code is null limit 1;
    `)) as unknown as { id: number }[];

    const result = await useCase.execute({ facilityId: plain!.id });
    // An empty list with no reason is what makes a working feature look broken.
    expect(result.status).toBe("FACILITY_WITHOUT_CNES_CODE");
    expect(result.items).toHaveLength(0);
  });
});
