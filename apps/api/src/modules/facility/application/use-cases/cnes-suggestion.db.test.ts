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
const COUNCIL = "71";

const useCase = new ListCnesSuggestionsUseCase();

interface Fixture {
  facilityId: number;
  linkedPersonId: number;
  freePersonId: number;
  adminOnlyPersonId: number;
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
     where professional_cnes_id in (${SUS_LINKED}, ${SUS_FREE}, ${SUS_UNKNOWN}, ${SUS_ADMIN_ONLY});
  `);
  await db.execute(sql`
    delete from registry.professionals
     where cnes_id in (${SUS_LINKED}, ${SUS_FREE}, ${SUS_UNKNOWN}, ${SUS_ADMIN_ONLY});
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
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into facilities (name, location, legal_document_type, state_id, municipality_id, cnes_code)
      select ${MARK}, ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326), 'CNPJ', m.state_id, m.id, ${CNES_CODE}
        from municipalities m limit 1;
  `);
  const [facility] = (await db.execute(sql`
    select id from facilities where name = ${MARK} limit 1;
  `)) as unknown as { id: number }[];

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

  for (const [sus, name] of [
    [SUS_LINKED, "DOUTOR LINKED"],
    [SUS_FREE, "DOUTOR FREE"],
    [SUS_ADMIN_ONLY, "DOUTOR ADMIN ONLY"],
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

  return {
    facilityId: facility!.id,
    linkedPersonId: people[SUS_LINKED]!,
    freePersonId: people[SUS_FREE]!,
    adminOnlyPersonId: adminOnly!.id,
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

  it("excludes someone already linked to this facility, server-side", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    expect(result.items.map((i) => i.personId)).not.toContain(fixture.linkedPersonId);
  });

  it("omits registry people who do not exist on our side", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    // Four registry vínculos here: one linked as a clinician (excluded), one
    // unknown to us (omitted), and two suggestible.
    expect(result.items).toHaveLength(2);
  });

  it("still suggests someone linked only as an administrative contact", async () => {
    const result = await useCase.execute({ facilityId: fixture.facilityId });
    // `person_facilities` says "linked"; the classification says as what. The
    // "já associados" section is healthcare-scoped, so excluding on the bare
    // link would hide this doctor from every section of the sheet.
    expect(result.items.map((i) => i.personId)).toContain(fixture.adminOnlyPersonId);
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
