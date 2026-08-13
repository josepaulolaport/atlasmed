import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import type { ScopeContext } from "@atlasmed/access";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import { AssociateCnesProfessionalUseCase } from "./cnes-association.use-cases";

/**
 * Linking a doctor we already hold to a clinic CNES places them at (spec 0012 §5).
 *
 * The claim being proved is the one the feature got wrong: associating used to
 * go through the generic projection upsert, which knows nothing about the
 * registry, so the roster gained a clinician and `person_facility_occupations`
 * stayed exactly as it was. Every assertion here is about what the database
 * ends up containing, because a fake repository would happily report success
 * with the same rows missing.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-CNES-ASSOC";
const CNES_CODE = "9990004";
const SUS_BRIDGED = "CCCC000000000001";
const SUS_HELD_ONLY = "CCCC000000000002";
const SUS_PRELINKED = "CCCC000000000003";
const SUS_UNKNOWN = "CCCC000000000004";
const SUS_ELSEWHERE = "CCCC000000000005";
const COUNCIL = "71";
const ALL_SUS = [
  SUS_BRIDGED,
  SUS_HELD_ONLY,
  SUS_PRELINKED,
  SUS_UNKNOWN,
  SUS_ELSEWHERE,
];

/** Both seeded by migration 0102, which is what makes them writable at all. */
const CBO_ANESTESIOLOGISTA = "225151";
const CBO_INTENSIVISTA = "225150";

const useCase = new AssociateCnesProfessionalUseCase();
const globalScope = { isGlobal: true, facilityIds: [] } as unknown as ScopeContext;

interface Fixture {
  facilityId: number;
  bridgedPersonId: number;
  holderPersonId: number;
  prelinkedPersonId: number;
  unrelatedOccupationId: number;
}

async function purge() {
  await db.execute(sql`
    delete from person_professional_registrations where person_id in (
      select id from persons where last_name = ${MARK}
    );
  `);
  await db.execute(sql`
    delete from person_healthcare_profiles where person_id in (
      select id from persons where last_name = ${MARK}
    );
  `);
  await db.execute(sql`delete from persons where last_name = ${MARK};`);
  await db.execute(sql`
    delete from registry.facility_professional_occupations where facility_cnes_id = ${CNES_CODE};
  `);
  await db.execute(sql`
    delete from registry.facility_professionals where facility_cnes_id = ${CNES_CODE};
  `);
  await db.execute(sql`
    delete from registry.professional_registrations where professional_cnes_id in ${ALL_SUS};
  `);
  await db.execute(sql`
    delete from registry.professionals where cnes_id in ${ALL_SUS};
  `);
  await db.execute(sql`delete from registry.facilities where cnes_id = ${CNES_CODE};`);
  await db.execute(sql`delete from facilities where name = ${MARK};`);
}

async function createPerson(firstName: string): Promise<number> {
  await db.execute(sql`
    insert into persons (first_name, last_name) values (${firstName}, ${MARK});
  `);
  const [row] = (await db.execute(sql`
    select id from persons where first_name = ${firstName} and last_name = ${MARK} limit 1;
  `)) as unknown as { id: number | string }[];
  // bigint arrives as a string from this driver.
  return Number(row!.id);
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      select 'T-CNES-ASSOC UF', '93', 'ZA'
       where not exists (select 1 from states);
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-CNES-ASSOC City', '9300001'
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
  `)) as unknown as { id: number | string }[];
  if (!facility) throw new Error("fixture facility was not created");
  const facilityId = Number(facility.id);

  await db.execute(sql`
    insert into registry.facilities (cnes_id, atlasmed_id, trade_name)
      values (${CNES_CODE}, ${facilityId}, ${MARK});
  `);
  await db.execute(sql`
    insert into registry.professional_councils (cnes_id, name, abbreviation)
      values (${COUNCIL}, 'Conselho Regional de Medicina', 'CRM')
      on conflict (cnes_id) do nothing;
  `);

  for (const [sus, name] of [
    [SUS_BRIDGED, "DOUTORA JA CONHECIDA"],
    [SUS_HELD_ONLY, "DOUTOR SO PELO CRM"],
    [SUS_PRELINKED, "DOUTOR JA VINCULADO"],
    [SUS_UNKNOWN, "DOUTOR DESCONHECIDO"],
    [SUS_ELSEWHERE, "DOUTOR DE OUTRA CLINICA"],
  ] as const) {
    await db.execute(sql`
      insert into registry.professionals (cnes_id, full_name) values (${sus}, ${name});
    `);
  }

  // Everyone except SUS_ELSEWHERE is placed at this clinic by CNES.
  for (const sus of [SUS_BRIDGED, SUS_HELD_ONLY, SUS_PRELINKED, SUS_UNKNOWN]) {
    await db.execute(sql`
      insert into registry.facility_professionals (facility_cnes_id, professional_cnes_id)
        values (${CNES_CODE}, ${sus});
    `);
  }

  /*
   * The registry catalogue, seeded here rather than assumed.
   *
   * `registry.occupations` is filled by the monthly load, not by a migration —
   * so a database migrated from empty has none, and the vínculo rows below
   * would fail their foreign key. The names are CNES's; migration 0102 is what
   * gives the public catalogue the shorter ones the assertions expect.
   */
  for (const [cbo, name] of [
    [CBO_ANESTESIOLOGISTA, "MEDICO ANESTESIOLOGISTA"],
    [CBO_INTENSIVISTA, "MEDICO EM MEDICINA INTENSIVA"],
  ] as const) {
    await db.execute(sql`
      insert into registry.occupations (cnes_id, name) values (${cbo}, ${name})
        on conflict (cnes_id) do nothing;
    `);
  }

  // Two CBOs each for the three we will associate, so "which one is primary"
  // is a real question rather than a trivially satisfied one.
  for (const sus of [SUS_BRIDGED, SUS_HELD_ONLY, SUS_PRELINKED]) {
    for (const cbo of [CBO_ANESTESIOLOGISTA, CBO_INTENSIVISTA]) {
      await db.execute(sql`
        insert into registry.facility_professional_occupations
          (facility_cnes_id, professional_cnes_id, occupation_cnes_id)
          values (${CNES_CODE}, ${sus}, ${cbo})
          on conflict do nothing;
      `);
    }
  }

  /*
   * Three ways of holding the same doctor, because the use case resolves them
   * in that order and each route reaches a different set of real rows:
   * the loader's bridge, a council registration nobody bridged, and a person
   * already linked here by hand.
   */
  const bridgedPersonId = await createPerson("Bridged");
  await db.execute(sql`
    insert into person_healthcare_profiles (person_id) values (${bridgedPersonId});
  `);
  await db.execute(sql`
    update registry.professionals set atlasmed_id = ${bridgedPersonId}
     where cnes_id = ${SUS_BRIDGED};
  `);

  const holderPersonId = await createPerson("Holder");
  // A registration references the profile, not the person, so it has to exist
  // first — the same reason the associate path ensures one.
  await db.execute(sql`
    insert into person_healthcare_profiles (person_id) values (${holderPersonId});
  `);
  await db.execute(sql`
    insert into registry.professional_registrations
      (professional_cnes_id, council_cnes_id, state_code, registration_number)
      values (${SUS_HELD_ONLY}, ${COUNCIL}, 'SP', '9980002');
  `);
  // Councils are reference data on our side, hand-seeded rather than ingested —
  // so a database migrated from empty has none, and an insert selecting from it
  // would write nothing and take the assertion down with it silently.
  await db.execute(sql`
    insert into person_professional_registration_councils (name, abbreviation)
      values ('Conselho Regional de Medicina', 'CRM')
      on conflict (abbreviation) do nothing;
  `);
  await db.execute(sql`
    insert into person_professional_registrations (person_id, council_id, state_code, registration_number)
      select ${holderPersonId}, c.id, 'SP', '9980002'
        from person_professional_registration_councils c
       where c.abbreviation = 'CRM' limit 1;
  `);
  const [registration] = (await db.execute(sql`
    select count(*)::int as n from person_professional_registrations
     where person_id = ${holderPersonId};
  `)) as unknown as { n: number }[];
  if (registration!.n !== 1) {
    throw new Error("fixture registration was not written");
  }

  const prelinkedPersonId = await createPerson("Prelinked");
  await db.execute(sql`
    update registry.professionals set atlasmed_id = ${prelinkedPersonId}
     where cnes_id = ${SUS_PRELINKED};
  `);

  // An occupation CNES does not record here, already primary on an affiliation
  // somebody created by hand. Associating must not steal the primary flag.
  const [occupation] = (await db.execute(sql`
    select id from occupations
     where cnes_id not in (${CBO_ANESTESIOLOGISTA}, ${CBO_INTENSIVISTA})
     order by id limit 1;
  `)) as unknown as { id: number | string }[];
  if (!occupation) throw new Error("no third occupation to test primary against");
  const unrelatedOccupationId = Number(occupation.id);

  await db.execute(sql`
    insert into person_facilities (person_id, facility_id)
      values (${prelinkedPersonId}, ${facilityId});
  `);
  await db.execute(sql`
    insert into person_facility_occupations (person_facility_id, occupation_id, is_primary)
      select pf.id, ${unrelatedOccupationId}, true
        from person_facilities pf
       where pf.person_id = ${prelinkedPersonId} and pf.facility_id = ${facilityId};
  `);

  return {
    facilityId,
    bridgedPersonId,
    holderPersonId,
    prelinkedPersonId,
    unrelatedOccupationId,
  };
}

async function occupationsAt(
  personId: number,
  facilityId: number
): Promise<{ name: string; isPrimary: boolean }[]> {
  const rows = (await db.execute(sql`
    select o.name, pfo.is_primary
      from person_facility_occupations pfo
      join person_facilities pf on pf.id = pfo.person_facility_id
      join occupations o on o.id = pfo.occupation_id
     where pf.person_id = ${personId}
       and pf.facility_id = ${facilityId}
       and pf.ended_at is null
     order by o.name;
  `)) as unknown as { name: string; is_primary: boolean }[];
  return rows.map((r) => ({ name: r.name, isPrimary: r.is_primary }));
}

async function activeAffiliations(
  personId: number,
  facilityId: number
): Promise<number> {
  const [row] = (await db.execute(sql`
    select count(*)::int as n from person_facilities
     where person_id = ${personId} and facility_id = ${facilityId} and ended_at is null;
  `)) as unknown as { n: number }[];
  return row!.n;
}

describe.if(dbUp)("AssociateCnesProfessionalUseCase", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(async () => {
    if (dbUp) await purge();
  });

  it("records what CNES says they do here, which associating used to drop", async () => {
    const result = await useCase.execute({
      facilityId: fixture.facilityId,
      professionalCnesId: SUS_BRIDGED,
      scope: globalScope,
    });

    expect(result.personId).toBe(fixture.bridgedPersonId);
    expect(result.created).toBe(true);

    const occupations = await occupationsAt(
      fixture.bridgedPersonId,
      fixture.facilityId
    );
    expect(occupations.map((o) => o.name)).toEqual([
      "Anestesiologista",
      "Intensivista",
    ]);
    // person_facility_occupations_primary_uidx allows exactly one.
    expect(occupations.filter((o) => o.isPrimary)).toHaveLength(1);
  });

  it("links them as a clinician, not merely as a person at a facility", async () => {
    const [row] = (await db.execute(sql`
      select count(*)::int as n
        from person_facilities pf
        join person_facility_classification_assignments pfca on pfca.person_facility_id = pf.id
        join person_facility_classifications c on c.id = pfca.classification_id
        join person_healthcare_profiles hp on hp.person_id = pf.person_id
       where pf.person_id = ${fixture.bridgedPersonId}
         and pf.facility_id = ${fixture.facilityId}
         and pf.ended_at is null
         and c.code = 'HEALTHCARE_PROFESSIONAL';
    `)) as unknown as { n: number }[];
    expect(row!.n).toBe(1);
  });

  it("is idempotent — a second tap adds neither an affiliation nor a row", async () => {
    const again = await useCase.execute({
      facilityId: fixture.facilityId,
      professionalCnesId: SUS_BRIDGED,
      scope: globalScope,
    });

    expect(again.personId).toBe(fixture.bridgedPersonId);
    expect(again.created).toBe(false);
    expect(await activeAffiliations(fixture.bridgedPersonId, fixture.facilityId)).toBe(1);
    expect(
      await occupationsAt(fixture.bridgedPersonId, fixture.facilityId)
    ).toHaveLength(2);
  });

  it("finds someone held only by their council registration, and bridges them", async () => {
    /*
     * The 409 case from the import's point of view: the registration is already
     * held, so no person may be created — but the doctor is real and works
     * here. Resolving them by registration is what turns that refusal into an
     * association instead of a dead end.
     */
    const result = await useCase.execute({
      facilityId: fixture.facilityId,
      professionalCnesId: SUS_HELD_ONLY,
      scope: globalScope,
    });

    expect(result.personId).toBe(fixture.holderPersonId);
    expect(
      await occupationsAt(fixture.holderPersonId, fixture.facilityId)
    ).toHaveLength(2);

    // Written now rather than waiting for next month's load to reach the same
    // conclusion on the same evidence.
    const [bridge] = (await db.execute(sql`
      select atlasmed_id from registry.professionals where cnes_id = ${SUS_HELD_ONLY};
    `)) as unknown as { atlasmed_id: number | string | null }[];
    expect(Number(bridge!.atlasmed_id)).toBe(fixture.holderPersonId);
  });

  it("leaves an existing primary occupation alone", async () => {
    /*
     * The affiliation predates CNES: somebody recorded what this doctor does
     * here by hand. Adding the CBO must extend that, not overrule it — and the
     * partial unique index would refuse a second primary outright.
     */
    const result = await useCase.execute({
      facilityId: fixture.facilityId,
      professionalCnesId: SUS_PRELINKED,
      scope: globalScope,
    });
    expect(result.created).toBe(false);

    const occupations = await occupationsAt(
      fixture.prelinkedPersonId,
      fixture.facilityId
    );
    expect(occupations).toHaveLength(3);
    const primary = occupations.filter((o) => o.isPrimary);
    expect(primary).toHaveLength(1);

    const [kept] = (await db.execute(sql`
      select name from occupations where id = ${fixture.unrelatedOccupationId};
    `)) as unknown as { name: string }[];
    expect(primary[0]!.name).toBe(kept!.name);
  });

  it("narrows the occupations a client sends to what CNES records here", async () => {
    // The CBO is a sourced fact. A rep may drop one; inventing one would turn
    // free text into something that still reads as coming from the export.
    const [intensivista] = (await db.execute(sql`
      select id from occupations where cnes_id = ${CBO_INTENSIVISTA};
    `)) as unknown as { id: number | string }[];

    await db.execute(sql`
      delete from person_facilities
       where person_id = ${fixture.bridgedPersonId} and facility_id = ${fixture.facilityId};
    `);

    await useCase.execute({
      facilityId: fixture.facilityId,
      professionalCnesId: SUS_BRIDGED,
      scope: globalScope,
      occupationIds: [Number(intensivista!.id), 999_999],
    });

    expect(
      (await occupationsAt(fixture.bridgedPersonId, fixture.facilityId)).map(
        (o) => o.name
      )
    ).toEqual(["Intensivista"]);
  });

  it("refuses someone CNES does not place at this clinic", async () => {
    expect(await reasonFor(SUS_ELSEWHERE)).toMatch(
      /does not place this professional at this facility/
    );
  });

  it("refuses someone we do not hold, rather than creating them", async () => {
    // Creating a person is the import's job, and it carries required fields
    // this endpoint has no way to collect.
    expect(await reasonFor(SUS_UNKNOWN)).toMatch(/import them/);
    const [row] = (await db.execute(sql`
      select count(*)::int as n from person_healthcare_profiles
       where cnes_professional_id = ${SUS_UNKNOWN};
    `)) as unknown as { n: number }[];
    expect(row!.n).toBe(0);
  });

  it("refuses a registry professional that does not exist", async () => {
    await expect(
      useCase.execute({
        facilityId: fixture.facilityId,
        professionalCnesId: "NOPE000000000000",
        scope: globalScope,
      })
    ).rejects.toThrow();
  });

  /** `ValidationError`'s message is generic; the reason lives in its context. */
  async function reasonFor(professionalCnesId: string): Promise<string> {
    try {
      await useCase.execute({
        facilityId: fixture.facilityId,
        professionalCnesId,
        scope: globalScope,
      });
    } catch (error) {
      const context = (error as { context?: { errors?: { message: string }[] } })
        .context;
      return context?.errors?.map((e) => e.message).join("; ") ?? String(error);
    }
    throw new Error(`associating ${professionalCnesId} was expected to fail`);
  }
});
