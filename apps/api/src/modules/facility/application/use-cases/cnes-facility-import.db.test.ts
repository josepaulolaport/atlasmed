import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable, uniqueAbbreviation } from "../../../../test-utils/db-harness";
import { ValidationError } from "../../../../shared/errors";
import { DrizzleCnesFacilityImportRepository } from "../../infrastructure/repositories/drizzle/drizzle-cnes-facility-import.repository";
import { ImportCnesFacilityUseCase } from "./cnes-facility-import.use-cases";

/**
 * The two write paths of §6.1, against a real database.
 *
 * These are not assertions about a fake: the claims are about a transaction that
 * spans `public.facilities`, `facility_vertical_profiles` and
 * `registry.facilities.atlasmed_id`, and about a unique index. A fake that
 * performed the write would prove only that the fake works.
 *
 * Fixtures own reserved geography and delete it. Borrowing a real UF passes on a
 * production clone and collides on an empty database — or the reverse — and the
 * failure surfaces in an unrelated suite.
 */
const dbUp = await isDatabaseReachable();

/**
 * Every id here is coerced. `facilities.id`, `business_verticals.id` and
 * `unit_types.id` are all `bigint`, and the driver returns those as strings — so
 * an uncoerced fixture id compares unequal to the number the use case returns,
 * and the test fails for a reason that has nothing to do with the behaviour.
 */

const NEW_CNES = "T9990101";
const OURS_CNES = "T9990102";
const CNPJ_CLASH_CNES = "T9990103";
const DEACTIVATED_CNES = "T9990104";
const NOT_IMPORTABLE_CNES = "T9990105";
const NO_POINT_CNES = "T9990106";
const ROSTER_CNES = "T9990107";
const ALL_CNES = [
  NEW_CNES, OURS_CNES, CNPJ_CLASH_CNES, DEACTIVATED_CNES,
  NOT_IMPORTABLE_CNES, NO_POINT_CNES, ROSTER_CNES,
];

const STATE_IBGE = "9971";
const MUN_IBGE = "99710010";
const MUN_CNES = "997100";
/** Only in the registry — proves the import creates a missing município (§4.5). */
const MUN_ONLY_IN_REGISTRY = "997101";
/**
 * The registry's state key is the sigla, and `registry_states_cnes_id_len_check`
 * requires exactly two characters. A digit makes it impossible to collide with a
 * real UF — an earlier version deleted `like 'T%'`, which matches **TO**, and
 * only the foreign key from Tocantins' municipalities stopped it.
 */
const REGISTRY_STATE_CNES = "T7";
const IMPORTABLE_TYPE = "T1";
const EXCLUDED_TYPE = "T2";
const MARK = "T-CNES-IMPORT";
const STAGED_SUS = "T99000001";
const STAGED_COUNCIL = "71";
const STAGED_CBO = "225125";


let stateId = 0;
let municipalityId = 0;
let verticalId = 0;
let otherVerticalId = 0;
let importableUnitTypeId = 0;
let clashFacilityId = 0;

const repository = new DrizzleCnesFacilityImportRepository();

function useCase() {
  return new ImportCnesFacilityUseCase({ repository });
}

async function purge() {
  await db.execute(sql`
    delete from facility_vertical_profiles
     where facility_id in (select id from facilities where name like ${MARK + "%"});
  `);
  await db.execute(sql`delete from facilities where name like ${MARK + "%"};`);
  /*
   * Roster first: `registry.facility_professionals` RESTRICTs the facility it
   * points at, so deleting the establishment before its staff fails.
   */
  await db.execute(sql`
    delete from registry.facility_professional_occupations
     where facility_cnes_id = any(string_to_array(${ALL_CNES.join(",")}, ','));
  `);
  await db.execute(sql`
    delete from registry.facility_professionals
     where facility_cnes_id = any(string_to_array(${ALL_CNES.join(",")}, ','));
  `);
  await db.execute(sql`delete from registry.professional_registrations where professional_cnes_id = ${STAGED_SUS};`);
  await db.execute(sql`delete from registry.professionals where cnes_id = ${STAGED_SUS};`);
  // Drizzle's sql template flattens an array into one placeholder per element,
  // so `any(${arr})` binds a scalar. Split a delimited string server-side.
  await db.execute(sql`
    delete from registry.facilities
     where cnes_id = any(string_to_array(${ALL_CNES.join(",")}, ','))
        or cnes_id = ${"T9990199"};
  `);
  await db.execute(
    sql`delete from registry.municipalities where cnes_id in (${MUN_CNES}, ${MUN_ONLY_IN_REGISTRY});`
  );
  await db.execute(sql`delete from registry.states where cnes_id = ${REGISTRY_STATE_CNES};`);
  await db.execute(
    sql`delete from registry.unit_types where cnes_id in (${IMPORTABLE_TYPE}, ${EXCLUDED_TYPE});`
  );
  await db.execute(sql`delete from municipalities where ibge_id in (${MUN_IBGE}, ${MUN_ONLY_IN_REGISTRY});`);
  await db.execute(sql`delete from states where ibge_id = ${STATE_IBGE};`);
  await db.execute(sql`delete from unit_types where cnes_id in (${IMPORTABLE_TYPE}, ${EXCLUDED_TYPE});`);
  await db.execute(sql`delete from business_verticals where code like ${MARK + "%"};`);
  await db.execute(sql`delete from ingestion.carga_staging where professional_sus_id = ${STAGED_SUS};`);
  await db.execute(sql`delete from ingestion.professional_staging where professional_sus_id = ${STAGED_SUS};`);
}

describe.if(dbUp)("importing a CNES establishment (database)", () => {
  beforeAll(async () => {
    await purge();

    const abbreviation = uniqueAbbreviation();
    const [state] = (await db.execute(sql`
      insert into states (name, abbreviation, ibge_id)
      values (${MARK + " State"}, ${abbreviation}, ${STATE_IBGE}) returning id
    `)) as unknown as { id: number }[];
    stateId = Number(state!.id);

    const [mun] = (await db.execute(sql`
      insert into municipalities (name, ibge_id, cnes_code, state_id)
      values (${MARK + " City"}, ${MUN_IBGE}, ${MUN_CNES}, ${stateId}) returning id
    `)) as unknown as { id: number }[];
    municipalityId = Number(mun!.id);

    const [vertical] = (await db.execute(sql`
      insert into business_verticals (code, name)
      values (${MARK + "-V1"}, ${MARK + " Vertical"}) returning id
    `)) as unknown as { id: number }[];
    verticalId = Number(vertical!.id);
    const [other] = (await db.execute(sql`
      insert into business_verticals (code, name)
      values (${MARK + "-V2"}, ${MARK + " Other"}) returning id
    `)) as unknown as { id: number }[];
    otherVerticalId = Number(other!.id);

    const [unitType] = (await db.execute(sql`
      insert into unit_types (cnes_id, name)
      values (${IMPORTABLE_TYPE}, ${MARK + " Clinic"}) returning id
    `)) as unknown as { id: number }[];
    importableUnitTypeId = Number(unitType!.id);

    // `atlasmed_id` set = importable. Unset = mirrored and never offered (§3.2).
    await db.execute(sql`
      insert into registry.unit_types (cnes_id, name, atlasmed_id)
      values (${IMPORTABLE_TYPE}, ${MARK + " Clinic"}, ${importableUnitTypeId}),
             (${EXCLUDED_TYPE}, ${MARK + " Not a sales site"}, null)
    `);
    await db.execute(sql`
      insert into registry.states (cnes_id, name, atlasmed_id)
      values (${REGISTRY_STATE_CNES}, ${MARK + " State"}, ${stateId})
      on conflict (cnes_id) do nothing
    `);
    const registryStateCnesId = REGISTRY_STATE_CNES;
    await db.execute(sql`
      insert into registry.municipalities (cnes_id, name, state_cnes_id, atlasmed_id)
      values (${MUN_CNES}, ${MARK + " City"}, ${registryStateCnesId}, ${municipalityId}),
             (${MUN_ONLY_IN_REGISTRY}, ${MARK + " Unheld City"}, ${registryStateCnesId}, null)
    `);

    // A facility we already hold, bridged, with a profile in one vertical only.
    const [ours] = (await db.execute(sql`
      insert into facilities (name, cnes_code, legal_document_type, legal_document,
                              state_id, municipality_id, location)
      values (${MARK + " Ours"}, ${OURS_CNES}, 'CNPJ', ${"99000000000191"},
              ${stateId}, ${municipalityId},
              ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326))
      returning id
    `)) as unknown as { id: number }[];
    await db.execute(sql`
      insert into facility_vertical_profiles (facility_id, vertical_id)
      values (${ours!.id}, ${otherVerticalId})
    `);

    // The CNPJ clash: a different establishment already holds this document.
    const [clash] = (await db.execute(sql`
      insert into facilities (name, cnes_code, legal_document_type, legal_document,
                              state_id, municipality_id, location)
      values (${MARK + " Clash Holder"}, ${"T9990199"}, 'CNPJ', ${"99000000000272"},
              ${stateId}, ${municipalityId},
              ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326))
      returning id
    `)) as unknown as { id: number }[];
    clashFacilityId = Number(clash!.id);

    const rows: [string, string | null, string | null, string | null, string | null, number | null][] = [
      [NEW_CNES, IMPORTABLE_TYPE, null, "99000000000353", MUN_CNES, null],
      [OURS_CNES, IMPORTABLE_TYPE, null, "99000000000191", MUN_CNES, ours!.id],
      [CNPJ_CLASH_CNES, IMPORTABLE_TYPE, null, "99000000000272", MUN_CNES, null],
      [DEACTIVATED_CNES, IMPORTABLE_TYPE, "01", "99000000000434", MUN_CNES, null],
      [NOT_IMPORTABLE_CNES, EXCLUDED_TYPE, null, "99000000000515", MUN_CNES, null],
      [ROSTER_CNES, IMPORTABLE_TYPE, null, "99000000000696", MUN_CNES, null],
    ];
    for (const [cnes, type, deactivated, cnpj, mun, atlas] of rows) {
      await db.execute(sql`
        insert into registry.facilities
          (cnes_id, cnes_unit_code, atlasmed_id, trade_name, legal_name,
           tax_id_cnpj, legal_person_type, unit_type_code, deactivation_reason_code,
           municipality_cnes_id, latitude, longitude)
        values (${cnes}, ${"U" + cnes}, ${atlas}, ${MARK + " " + cnes}, ${MARK + " Legal"},
                ${cnpj}, '3', ${type}, ${deactivated}, ${mun}, ${-23.5}, ${-46.6})
      `);
    }
    // No coordinates, and its município exists only in the registry.
    await db.execute(sql`
      insert into registry.facilities
        (cnes_id, cnes_unit_code, trade_name, legal_name, tax_id_cnpj,
         legal_person_type, unit_type_code, municipality_cnes_id, latitude, longitude)
      values (${NO_POINT_CNES}, ${"U" + NO_POINT_CNES}, ${MARK + " No Point"},
              ${MARK + " Legal"}, ${"99000000000596"}, '3', ${IMPORTABLE_TYPE},
              ${MUN_ONLY_IN_REGISTRY}, null, null)
    `);
  });

  afterAll(async () => {
    if (dbUp) await purge();
  });

  /**
   * Spec 0015 §6.7 — the reason the staging tables exist.
   *
   * The professional pipeline is scoped at *ingestion* time, so a clinic bridged
   * afterwards has no vínculos at all. Without deriving here, a clinic imported
   * the day after an ingestion shows an empty doctor list for up to a month, on
   * exactly the clinics somebody just went to the trouble of adding — and every
   * signal `CnesSuggestionContext` reads would say the data was loaded.
   */
  it("gives the new clinic its CNES doctors in the same transaction", async () => {
    /*
     * Staged under whichever competência the import will actually read — the run
     * ledger's COMPLETED one, falling back to the newest staged. Inventing a
     * competência here would stage rows the resolver correctly ignores, and the
     * test would fail for a reason that has nothing to do with the behaviour.
     */
    const [competence] = (await db.execute(sql`
      select coalesce(run.reference_year, staged.reference_year, 2999) as reference_year,
             coalesce(run.reference_month, staged.reference_month, 1) as reference_month
        from (select 1) one
        left join lateral (
          select reference_year, reference_month from ingestion.cnes_runs
           where status = 'COMPLETED' and promoted_at is not null
             and reference_year is not null and reference_month is not null
           order by promoted_at desc limit 1
        ) run on true
        left join lateral (
          select reference_year, reference_month from ingestion.carga_staging
           order by reference_year desc, reference_month desc limit 1
        ) staged on true
    `)) as unknown as { reference_year: number; reference_month: number }[];

    const year = Number(competence!.reference_year);
    const month = Number(competence!.reference_month);

    await db.execute(sql`
      insert into ingestion.professional_staging
        (reference_year, reference_month, professional_sus_id, name, cns)
      values (${year}, ${month}, ${STAGED_SUS}, ${MARK + " DOCTOR"}, null)
      on conflict do nothing
    `);
    await db.execute(sql`
      insert into ingestion.carga_staging
        (reference_year, reference_month, unit_code, professional_sus_id,
         council_code, registration_uf, registration_number, occupation_code)
      values (${year}, ${month}, ${"U" + ROSTER_CNES}, ${STAGED_SUS},
              ${STAGED_COUNCIL}, 'SP', ${"T9911223"}, ${STAGED_CBO})
    `);

    const result = await useCase().execute({
      cnesCode: ROSTER_CNES,
      role: "MANAGER",
      assignedVerticalIds: [verticalId],
    });
    expect(result.outcome).toBe("CREATED");

    const [row] = (await db.execute(sql`
      select
        (select count(*)::int from registry.facility_professionals
          where facility_cnes_id = ${ROSTER_CNES}) as roster,
        (select count(*)::int from registry.professionals
          where cnes_id = ${STAGED_SUS}) as professional,
        (select count(*)::int from registry.professional_registrations
          where professional_cnes_id = ${STAGED_SUS}) as registrations
    `)) as unknown as Record<string, number>[];

    expect(row!.roster).toBe(1);
    expect(row!.professional).toBe(1);
    // The registration is the identity the bridge to public.people is made on.
    expect(row!.registrations).toBe(1);
  });

  it("creates the facility, its profile and the bridge together", async () => {
    const result = await useCase().execute({
      cnesCode: NEW_CNES,
      role: "MANAGER",
      assignedVerticalIds: [verticalId],
    });

    expect(result.outcome).toBe("CREATED");

    const [row] = (await db.execute(sql`
      select f.id, f.cnes_code, f.unit_type_id, f.legal_document,
             ST_Y(f.location::geometry) as lat,
             rf.atlasmed_id as bridge,
             (select count(*)::int from facility_vertical_profiles p
               where p.facility_id = f.id and p.vertical_id = ${verticalId}) as profiles
        from facilities f
        join registry.facilities rf on rf.cnes_id = f.cnes_code
       where f.id = ${result.facilityId}
    `)) as unknown as Record<string, unknown>[];

    expect(row!.cnes_code).toBe(NEW_CNES);
    expect(Number(row!.bridge)).toBe(result.facilityId);
    expect(row!.profiles).toBe(1);
    expect(Number(row!.unit_type_id)).toBe(importableUnitTypeId);
    expect(Number(row!.lat)).toBeCloseTo(-23.5, 4);
  });

  /**
   * §6.1 case 2. Importing a clinic we already hold must add a profile and
   * nothing else — never a second facility, which `facilities_cnes_code_uidx`
   * would refuse anyway, but the flow has to resolve rather than collide.
   */
  it("adds only a vertical profile when the clinic is already ours", async () => {
    const before = (await db.execute(sql`
      select count(*)::int as n from facilities where cnes_code = ${OURS_CNES}
    `)) as unknown as { n: number }[];

    const result = await useCase().execute({
      cnesCode: OURS_CNES,
      role: "MANAGER",
      assignedVerticalIds: [verticalId],
    });

    expect(result.outcome).toBe("PROFILE_ADDED");
    expect(result.verticalIds).toEqual([verticalId]);

    const after = (await db.execute(sql`
      select count(*)::int as n from facilities where cnes_code = ${OURS_CNES}
    `)) as unknown as { n: number }[];
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("reports a clinic already visible to this vertical rather than writing", async () => {
    const result = await useCase().execute({
      cnesCode: OURS_CNES,
      role: "MANAGER",
      assignedVerticalIds: [otherVerticalId],
    });
    expect(result.outcome).toBe("ALREADY_VISIBLE");
  });

  /**
   * Two establishments claiming one legal entity. The flow names the facility
   * that holds it — failing on the unique index instead would give the user a
   * constraint name and no way forward.
   */
  it("refuses a CNPJ another facility already holds, and says which", async () => {
    const error = await useCase()
      .execute({
        cnesCode: CNPJ_CLASH_CNES,
        role: "MANAGER",
        assignedVerticalIds: [verticalId],
      })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(JSON.stringify(error)).toContain("Clash Holder");
    expect(clashFacilityId).toBeGreaterThan(0);
  });

  it("refuses an establishment CNES lists as deactivated", async () => {
    await expect(
      useCase().execute({
        cnesCode: DEACTIVATED_CNES,
        role: "MANAGER",
        assignedVerticalIds: [verticalId],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /** The allowlist lives on `registry.unit_types.atlasmed_id` (§3.2). */
  it("refuses a kind of establishment we do not import", async () => {
    await expect(
      useCase().execute({
        cnesCode: NOT_IMPORTABLE_CNES,
        role: "MANAGER",
        assignedVerticalIds: [verticalId],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /**
   * Spec 0009 R5: the point is required because ownership is geometric. CNES
   * lacks one for 272 of 494 273 active units, so the rule is "the point must
   * exist", not "CNES must have supplied it" — the user places it.
   */
  it("asks for a point when CNES has none", async () => {
    await expect(
      useCase().execute({
        cnesCode: NO_POINT_CNES,
        role: "MANAGER",
        assignedVerticalIds: [verticalId],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /**
   * §4.5, corrected. This used to create the município from the registry, on the
   * belief that CNES knew 33 municípios we did not. It knew none: 31 were
   * Brasília's regiões administrativas and 2 were Ministry internal codes
   * (`999999 SAS`, `222222 DRAC/CGSOS`) carrying no establishment.
   *
   * Creating one meant inventing an `ibge_id` from the 6-digit CNES code, which
   * is the IBGE code without its check digit — and that digit is a modulo-11
   * checksum with nine real exceptions, so it is not derivable. An unplaceable
   * establishment must fail where the user can see it.
   *
   * Runs before the sibling below, which bridges this município.
   */
  it("refuses an establishment CNES cannot place, rather than inventing geography", async () => {
    const before = (await db.execute(sql`
      select count(*)::int as n from municipalities where cnes_code = ${MUN_ONLY_IN_REGISTRY}
    `)) as unknown as { n: number }[];
    expect(before[0]!.n).toBe(0);

    await expect(
      useCase().execute({
        cnesCode: NO_POINT_CNES,
        lat: -23.4,
        lng: -46.5,
        role: "MANAGER",
        assignedVerticalIds: [verticalId],
      })
    ).rejects.toBeInstanceOf(ValidationError);

    // Nothing was minted on the way out.
    const after = (await db.execute(sql`
      select count(*)::int as n from municipalities where cnes_code = ${MUN_ONLY_IN_REGISTRY}
    `)) as unknown as { n: number }[];
    expect(after[0]!.n).toBe(0);
  });

  /**
   * The Distrito Federal, in miniature.
   *
   * CNES gives each of Brasília's 31 regiões administrativas its own
   * `CO_MUNICIPIO`; IBGE has one município there. So `registry.municipalities.
   * atlasmed_id` is legitimately **many-to-one**, and the unique index it used to
   * carry made the real world unrepresentable — the second locality to bridge
   * would have collided. Proven here against the database, because an index is
   * exactly the kind of claim a fake cannot test.
   */
  it("lets two CNES localities resolve to one município", async () => {
    await db.execute(sql`
      update registry.municipalities
         set atlasmed_id = ${municipalityId}
       where cnes_id = ${MUN_ONLY_IN_REGISTRY}
    `);

    const result = await useCase().execute({
      cnesCode: NO_POINT_CNES,
      lat: -23.4,
      lng: -46.5,
      role: "MANAGER",
      assignedVerticalIds: [verticalId],
    });
    expect(result.outcome).toBe("CREATED");

    const [row] = (await db.execute(sql`
      select f.municipality_id, f.state_id
        from facilities f where f.id = ${result.facilityId}
    `)) as unknown as Record<string, unknown>[];

    // Both localities land on the one município we actually hold.
    expect(Number(row!.municipality_id)).toBe(municipalityId);
    expect(Number(row!.state_id)).toBe(stateId);
  });
});
