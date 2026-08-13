import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import type { ScopeContext } from "@atlasmed/access";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import {
  CnesRegistrationAlreadyHeldError,
  ImportCnesProfessionalUseCase,
  resolveOccupations,
  splitRegistryName,
} from "./cnes-import.use-cases";

/**
 * Creating a person from the registry, against a real database (spec 0012 §6).
 *
 * The claim worth proving is a negative — that this can never produce a second
 * record for a doctor we already hold — and it rests on a unique index. A fake
 * repository has no unique index, so it can only demonstrate that the code
 * *intends* not to duplicate. Here the constraint is present and the assertions
 * are about what the database ends up containing.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-CNES-IMPORT";
const CNES_CODE = "9990003";
const SUS_NEW = "BBBB000000000001";
const SUS_HELD = "BBBB000000000002";
const SUS_ELSEWHERE = "BBBB000000000003";
const SUS_NO_REGISTRATION = "BBBB000000000004";
const COUNCIL = "71";
const ALL_SUS = [SUS_NEW, SUS_HELD, SUS_ELSEWHERE, SUS_NO_REGISTRATION];

const useCase = new ImportCnesProfessionalUseCase();

const globalScope = { isGlobal: true, facilityIds: [] } as unknown as ScopeContext;

interface Fixture {
  facilityId: number;
  holderPersonId: number;
}

async function purge() {
  /**
   * People this suite *imported* carry CNES's surname, not the fixture marker,
   * so deleting by marker alone leaves them behind — and the next run then finds
   * their CRM already held and refuses the very import it is testing. Identify
   * them the way the import does: by the SUS id on their healthcare profile.
   */
  await db.execute(sql`
    delete from person_professional_registrations where person_id in (
      select person_id from person_healthcare_profiles
       where cnes_professional_id in ${ALL_SUS}
    );
  `);
  await db.execute(sql`
    delete from persons where id in (
      select person_id from person_healthcare_profiles
       where cnes_professional_id in ${ALL_SUS}
    );
  `);
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
  await db.execute(sql`delete from facilities where name = ${MARK};`);
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      select 'T-CNES-IMPORT UF', '92', 'ZI'
       where not exists (select 1 from states);
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-CNES-IMPORT City', '9200001'
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
  if (!facility) {
    throw new Error("fixture facility was not created");
  }
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
    [SUS_NEW, "MARINA COSTA ALMEIDA"],
    [SUS_HELD, "OUTRO MEDICO HOMONIMO"],
    [SUS_ELSEWHERE, "MEDICO DE OUTRA CLINICA"],
    [SUS_NO_REGISTRATION, "MEDICO SEM REGISTRO"],
  ] as const) {
    await db.execute(sql`
      insert into registry.professionals (cnes_id, full_name) values (${sus}, ${name});
    `);
  }

  // Everyone except SUS_ELSEWHERE is placed at this clinic by CNES.
  for (const sus of [SUS_NEW, SUS_HELD, SUS_NO_REGISTRATION]) {
    await db.execute(sql`
      insert into registry.facility_professionals (facility_cnes_id, professional_cnes_id)
        values (${CNES_CODE}, ${sus});
    `);
  }

  for (const [sus, number] of [
    [SUS_NEW, "9970001"],
    [SUS_HELD, "9970002"],
    [SUS_ELSEWHERE, "9970003"],
  ] as const) {
    await db.execute(sql`
      insert into registry.professional_registrations
        (professional_cnes_id, council_cnes_id, state_code, registration_number)
        values (${sus}, ${COUNCIL}, 'SP', ${number});
    `);
  }

  /**
   * Two CBOs CNES records for SUS_NEW **at this clinic**, both in our
   * catalogue: Anestesiologista (225151) and Intensivista (225150). Both were
   * seeded by migration 0102, which is what makes them writable at all.
   */
  for (const cbo of ["225151", "225150"]) {
    await db.execute(sql`
      insert into registry.facility_professional_occupations
        (facility_cnes_id, professional_cnes_id, occupation_cnes_id)
        values (${CNES_CODE}, ${SUS_NEW}, ${cbo})
        on conflict do nothing;
    `);
  }

  // Someone on our side already holds SUS_HELD's CRM. The import must find them
  // rather than attempt an insert the unique index would refuse.
  await db.execute(sql`
    insert into persons (first_name, last_name) values ('Holder', ${MARK});
  `);
  const [holder] = (await db.execute(sql`
    select id from persons where first_name = 'Holder' and last_name = ${MARK} limit 1;
  `)) as unknown as { id: number | string }[];
  const holderPersonId = Number(holder!.id);
  await db.execute(sql`
    insert into person_healthcare_profiles (person_id) values (${holderPersonId});
  `);
  await db.execute(sql`
    insert into person_professional_registrations (person_id, council_id, state_code, registration_number)
      select ${holderPersonId}, c.id, 'SP', '9970002'
        from person_professional_registration_councils c
       where c.abbreviation = 'CRM' limit 1;
  `);

  return { facilityId, holderPersonId };
}

describe("splitRegistryName", () => {
  it.each([
    ["MARINA COSTA ALMEIDA", "MARINA COSTA", "ALMEIDA"],
    ["CLEIDE", "CLEIDE", "CLEIDE"],
    ["  ANA   PAULA  DIAS  ", "ANA PAULA", "DIAS"],
  ])("splits %s", (input, firstName, lastName) => {
    expect(splitRegistryName(input)).toEqual({ firstName, lastName });
  });

  it("survives a blank registry name", () => {
    // The loader names people after their SUS id when NO_PROFISSIONAL is
    // missing, so this should never arrive — but returning "" lets the use case
    // report a validation error instead of writing a nameless person.
    expect(splitRegistryName("   ")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("resolveOccupations", () => {
  const professional = { occupationIds: [10, 20, 30] } as never;

  it("defaults to what CNES records when nothing is specified", () => {
    expect(resolveOccupations(undefined, professional)).toEqual([10, 20, 30]);
  });

  it("keeps the order the rep chose, because the first is primary", () => {
    expect(resolveOccupations([30, 10], professional)).toEqual([30, 10]);
  });

  it("honours an empty list as a deliberate answer", () => {
    // Distinct from `undefined`: the rep cleared them, which is a decision.
    expect(resolveOccupations([], professional)).toEqual([]);
  });

  it("refuses an occupation CNES does not record here", () => {
    /**
     * The CBO is a sourced fact about this clinic. Letting a client post any
     * occupation id would turn it into free text that still looks sourced —
     * and assigning an occupation nobody claimed is a roster action, not a
     * side effect of importing.
     */
    expect(resolveOccupations([10, 999], professional)).toEqual([10]);
  });

  it("drops a repeat rather than letting it take a second row", () => {
    expect(resolveOccupations([10, 10, 20], professional)).toEqual([10, 20]);
  });
});

describe.if(dbUp)("ImportCnesProfessionalUseCase", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(async () => {
    if (dbUp) await purge();
  });

  it("creates the person, their registration and the bridge together", async () => {
    const result = await useCase.execute({
      facilityId: fixture.facilityId,
      professionalCnesId: SUS_NEW,
      scope: globalScope,
    });

    expect(result.created).toBe(true);
    expect(typeof result.personId).toBe("number");

    const [written] = (await db.execute(sql`
      select
        p.first_name,
        p.last_name,
        hp.cnes_professional_id                     as sus_id,
        ppr.registration_number                     as registration_number,
        ppr.is_primary                              as is_primary,
        rp.atlasmed_id                              as bridge
      from persons p
      join person_healthcare_profiles hp on hp.person_id = p.id
      join person_professional_registrations ppr on ppr.person_id = p.id
      join registry.professionals rp on rp.cnes_id = ${SUS_NEW}
      where p.id = ${result.personId};
    `)) as unknown as {
      first_name: string;
      last_name: string;
      sus_id: string | null;
      registration_number: string;
      is_primary: boolean;
      bridge: number | string | null;
    }[];

    // The name is split from CNES's single field; both halves are editable on
    // the way in, so this is a default rather than a rule.
    expect(written!.first_name).toBe("MARINA COSTA");
    expect(written!.last_name).toBe("ALMEIDA");
    // Identity, all three routes, written in the same transaction.
    expect(written!.sus_id).toBe(SUS_NEW);
    expect(written!.registration_number).toBe("9970001");
    expect(written!.is_primary).toBe(true);
    expect(Number(written!.bridge)).toBe(result.personId);
  });

  it("records what CNES says they do here, one of them primary", async () => {
    /**
     * The CBO is per-clinic — 1 854 of 19 137 professionals carry more than one
     * across different facilities — so this is a fact about the affiliation,
     * not about the person, and it lands on `person_facility_occupations`.
     */
    const [person] = (await db.execute(sql`
      select person_id from person_healthcare_profiles where cnes_professional_id = ${SUS_NEW};
    `)) as unknown as { person_id: number | string }[];

    const rows = (await db.execute(sql`
      select o.name, pfo.is_primary
        from person_facility_occupations pfo
        join person_facilities pf on pf.id = pfo.person_facility_id
        join occupations o on o.id = pfo.occupation_id
       where pf.person_id = ${Number(person!.person_id)}
         and pf.facility_id = ${fixture.facilityId}
       order by pfo.is_primary desc, o.name;
    `)) as unknown as { name: string; is_primary: boolean }[];

    expect(rows.map((r) => r.name).sort()).toEqual([
      "Anestesiologista",
      "Intensivista",
    ]);
    // person_facility_occupations_primary_uidx allows exactly one; the loader
    // has no ordering to offer, so the first the client sent wins.
    expect(rows.filter((r) => r.is_primary)).toHaveLength(1);
  });

  it("links the person to the clinic as a clinician in the same call", async () => {
    // The affiliation is created by the import rather than a second request:
    // occupations hang off person_facility_id, which does not exist until the
    // person works somewhere.
    const [row] = (await db.execute(sql`
      select count(*)::int as n
        from person_facilities pf
        join person_healthcare_profiles hp on hp.person_id = pf.person_id
        join person_facility_classification_assignments pfca on pfca.person_facility_id = pf.id
        join person_facility_classifications c on c.id = pfca.classification_id
       where hp.cnes_professional_id = ${SUS_NEW}
         and pf.facility_id = ${fixture.facilityId}
         and pf.ended_at is null
         and c.code = 'HEALTHCARE_PROFESSIONAL';
    `)) as unknown as { n: number }[];
    expect(row!.n).toBe(1);
  });

  it("returns the same person when the import is repeated", async () => {
    // Two reps importing the same doctor, or one double-tapping, is ordinary.
    const first = await useCase.execute({
      facilityId: fixture.facilityId,
      professionalCnesId: SUS_NEW,
      scope: globalScope,
    });
    expect(first.created).toBe(false);

    const [count] = (await db.execute(sql`
      select count(*)::int as n from persons where last_name = 'ALMEIDA' and first_name = 'MARINA COSTA';
    `)) as unknown as { n: number }[];
    expect(count!.n).toBe(1);
  });

  it("refuses rather than duplicating when the registration is already held", async () => {
    /**
     * The whole point of the endpoint. `(council_id, state_code,
     * registration_number)` is unique, so the insert could not have succeeded —
     * but an error tells the rep nothing. This reports *who* holds it, so the
     * client can associate that person instead.
     */
    const before = (await db.execute(sql`
      select count(*)::int as n from persons where last_name = ${MARK};
    `)) as unknown as { n: number }[];

    let thrown: unknown;
    try {
      await useCase.execute({
        facilityId: fixture.facilityId,
        professionalCnesId: SUS_HELD,
        scope: globalScope,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CnesRegistrationAlreadyHeldError);
    const conflict = thrown as CnesRegistrationAlreadyHeldError;
    expect(conflict.statusCode).toBe(409);
    expect(conflict.context?.personId).toBe(fixture.holderPersonId);
    expect(conflict.context?.registrationLabel).toContain("9970002");

    // Nothing was written on the way to refusing.
    const after = (await db.execute(sql`
      select count(*)::int as n from persons where last_name = ${MARK};
    `)) as unknown as { n: number }[];
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("exposes the id and the registration to the client, but not the name", async () => {
    // Professionals are scope-filtered. An id the caller can attempt to
    // associate — which checks scope again — discloses less than a name they
    // may not be entitled to read.
    const conflict = new CnesRegistrationAlreadyHeldError({
      personId: 42,
      personName: "Alguém Que Existe",
      registrationLabel: "CRM 9970002/SP",
    });
    const payload = conflict.toClientJSON();

    expect(payload.personId).toBe(42);
    expect(payload.registrationLabel).toBe("CRM 9970002/SP");
    expect(payload.personName).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("Alguém");
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
    throw new Error(`importing ${professionalCnesId} was expected to fail`);
  }

  it("refuses someone CNES does not place at this clinic", async () => {
    // Otherwise the endpoint is a general create-a-person-from-the-registry
    // tool, reachable by anyone with access to any single facility.
    expect(await reasonFor(SUS_ELSEWHERE)).toMatch(
      /does not place this professional at this facility/
    );
  });

  it("refuses someone carrying no registration we can resolve", async () => {
    /**
     * A person written without a registration is one no later load can
     * recognise: next month's export would offer to create them again, and
     * nothing would stop it — the unique guards a column they do not have.
     */
    expect(await reasonFor(SUS_NO_REGISTRATION)).toMatch(
      /no council registration/
    );
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
});
