import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createDatabase, type AnyDatabase } from "@atlasmed/database";
import { loadRegistryFromCsv } from "./load-registry";

/**
 * The loader against a real database.
 *
 * Both claims here are about rows that survive between two runs, which no
 * in-memory fake can demonstrate: the stale-roster bug this guards passed every
 * unit test in the package because the defect lived entirely in *which rows the
 * DELETE covered*.
 *
 * Fixtures are seeded and purged by marker rather than wrapped in a transaction —
 * `loadRegistryFromCsv` opens its own transaction for the snapshot swap, and the
 * point of the test is what two separate runs leave behind.
 */
const CNES_CODE = "9990001";
const UNIT_CODE = "3550309990001";
const DOCTOR_SUS = "9900001";
const NURSE_SUS = "9900002";
/**
 * Establishments we do **not** operate. Before spec 0015 the loader dropped
 * these on the floor; the registry now mirrors every one, which is what lets the
 * import surface answer "does this clinic exist at all".
 */
const STRANGER_CNES = "9990002";
const STRANGER_UNIT = "3550309990002";
/** Its gestor deliberately disagrees with the CO_UNIDADE prefix (§4.4). */
const STRANGER_GESTOR = "355030";
const STRANGER_OWN_MUNICIPALITY = "355040";
const JUNK_COORDS_CNES = "9990003";
const JUNK_COORDS_UNIT = "3550309990003";
const FACILITY_NAME = "T-CNES-LOADER fixture";
const PERSON_MARK = "T-CNES-LOADER-PERSON";
const DOCTOR_CRM = "9912345";
const DOCTOR_CRM_RJ = "9954321";
/** Órgão emissor for CRM, the code `tbCargaHorariaSus` actually carries. */
const COUNCIL_CNES_ID = "71";
const REFERENCE = { year: 2026, month: 5 } as const;

const connectionString = process.env.DATABASE_URL;
const db: AnyDatabase | null = connectionString ? createDatabase(connectionString) : null;

const dbUp = await (async () => {
  if (!db) return false;
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
})();

const dir = mkdtempSync(join(tmpdir(), "cnes-load-"));

function writeCsv(subdir: string, stem: string, rows: string[][]) {
  const target = join(dir, subdir);
  const body = rows.map((r) => r.join(";")).join("\r\n") + "\r\n";
  writeFileSync(join(target, `${stem}202605.csv`), Buffer.from(body, "latin1"));
}

/**
 * A minimal dump. `withDoctor: false` keeps the clinic reporting — it just has
 * nobody carrying a registration any more, which is how CNES represents "the last
 * registered professional left" and the case the delete used to skip.
 *
 * The nurse in that variant deliberately has a **blank `NU_REGISTRO`**: since ADR
 * 0009 the registration is the gate, so a row without one leaves the clinic with
 * zero qualifying staff — which is the only shape that exercises the bug.
 */
function buildDump(subdir: string, withDoctor: boolean) {
  mkdirSync(join(dir, subdir), { recursive: true });

  writeCsv(subdir, "tbEstado", [
    ["CO_SIGLA", "NO_DESCRICAO"],
    ["SP", "SAO PAULO"],
  ]);
  writeCsv(subdir, "tbMunicipio", [
    ["CO_MUNICIPIO", "NO_MUNICIPIO", "CO_SIGLA_ESTADO"],
    ["355030", "SAO PAULO", "SP"],
  ]);
  writeCsv(subdir, "tbAtividadeProfissional", [
    ["CO_CBO", "DS_ATIVIDADE_PROFISSIONAL", "TP_CBO_SAUDE", "ST_CBO_REGULAMENTADO"],
    ["225125", "MEDICO ORTOPEDISTA", "S", "S"],
    ["223505", "ENFERMEIRO", "S", "S"],
  ]);
  writeCsv(subdir, "tbTipoUnidade", [
    ["CO_TIPO_UNIDADE", "DS_TIPO_UNIDADE"],
    ["36", "CLINICA/CENTRO DE ESPECIALIDADE"],
    ["05", "HOSPITAL GERAL"],
  ]);
  writeCsv(subdir, "tbSubTipo", [
    ["CO_TIPO_UNIDADE", "CO_SUB_TIPO", "DS_SUB_TIPO"],
    ["36", "009", "CLINICA ESPECIALIZADA"],
  ]);
  writeCsv(subdir, "tbMotivoDesativacao", [
    ["CD_MOTIVO_DESAB", "DS_MOTIVO_DESAB"],
    ["01", "DESATIVADO TEMPORARIAMENTE PELA VIGILANCIA SANITARIA"],
  ]);
  writeCsv(subdir, "rlEstabSubTipo", [
    ["CO_UNIDADE", "CO_TIPO_UNIDADE", "CO_SUB_TIPO_UNIDADE"],
    [UNIT_CODE, "36", "009"],
  ]);
  writeCsv(subdir, "tbEstabelecimento", [
    [
      "CO_UNIDADE",
      "CO_CNES",
      "NO_RAZAO_SOCIAL",
      "NO_FANTASIA",
      "TP_UNIDADE",
      "CO_MUNICIPIO_GESTOR",
      "TP_PFPJ",
      "NU_CNPJ_MANTENEDORA",
      "NU_LATITUDE",
      "NU_LONGITUDE",
      "CO_MOTIVO_DESAB",
    ],
    [UNIT_CODE, CNES_CODE, "CLINICA FIXTURE LTDA", "CLINICA FIXTURE", "36", "355030",
     "3", "", "-23.5505", "-46.6333", ""],
  ]);
  writeCsv(subdir, "tbDadosProfissionalSus", [
    ["CO_PROFISSIONAL_SUS", "NO_PROFISSIONAL", "CO_CNS", "CO_CPF"],
    [DOCTOR_SUS, "DOUTOR FIXTURE", "700000000009901", "XXX.392.286.XX"],
    [NURSE_SUS, "ENFERMEIRO FIXTURE", "700000000009902", "XXX.111.222.XX"],
  ]);
  writeCsv(subdir, "tbCargaHorariaSus", [
    ["CO_UNIDADE", "CO_PROFISSIONAL_SUS", "CO_CBO", "CO_CONSELHO_CLASSE", "NU_REGISTRO", "SG_UF_CRM"],
    withDoctor
      ? [UNIT_CODE, DOCTOR_SUS, "225125", "71", DOCTOR_CRM, "SP"]
      : [UNIT_CODE, NURSE_SUS, "223505", "71", "", ""],
  ]);
}

/**
 * The scoped clinic plus establishments nobody operates — the shape spec 0015
 * introduced. Also carries the two coordinate formats CNES actually ships and
 * a município whose gestor disagrees with the `CO_UNIDADE` prefix.
 */
function buildNationalDump(subdir: string) {
  buildDump(subdir, true);
  writeCsv(subdir, "tbMunicipio", [
    ["CO_MUNICIPIO", "NO_MUNICIPIO", "CO_SIGLA_ESTADO"],
    ["355030", "SAO PAULO", "SP"],
    [STRANGER_OWN_MUNICIPALITY, "T-CNES-LOADER MUNICIPIO", "SP"],
  ]);
  writeCsv(subdir, "tbEstabelecimento", [
    [
      "CO_UNIDADE", "CO_CNES", "NO_RAZAO_SOCIAL", "NO_FANTASIA", "TP_UNIDADE",
      "CO_MUNICIPIO_GESTOR", "TP_PFPJ", "NU_CNPJ_MANTENEDORA",
      "NU_LATITUDE", "NU_LONGITUDE", "CO_MOTIVO_DESAB",
    ],
    [UNIT_CODE, CNES_CODE, "CLINICA FIXTURE LTDA", "CLINICA FIXTURE", "36", "355030",
     "3", "", "-23.5505", "-46.6333", ""],
    // Not ours. Unpadded type, comma decimals, and a gestor that is not where it is.
    [`${STRANGER_OWN_MUNICIPALITY}${STRANGER_CNES}`, STRANGER_CNES,
     "ESTRANHA LTDA", "CLINICA ESTRANHA", "5", STRANGER_GESTOR,
     "1", "11222333000144", "-13,8553786", "-40,0838023", ""],
    // Coordinates that are not coordinates: a latitude no point on Earth has.
    [JUNK_COORDS_UNIT, JUNK_COORDS_CNES, "JUNK LTDA", "CLINICA JUNK", "36", "355030",
     "3", "", "900", "-41.", ""],
  ]);
  writeCsv(subdir, "rlEstabSubTipo", [
    ["CO_UNIDADE", "CO_TIPO_UNIDADE", "CO_SUB_TIPO_UNIDADE"],
    [UNIT_CODE, "36", "009"],
  ]);
}

/**
 * The same doctor registered in two states — legitimate, and the only shape in
 * which one SUS id can match two different people, since `(council, UF, number)`
 * is unique on both sides.
 */
function buildDualUfDump(subdir: string) {
  buildDump(subdir, true);
  writeCsv(subdir, "tbCargaHorariaSus", [
    ["CO_UNIDADE", "CO_PROFISSIONAL_SUS", "CO_CBO", "CO_CONSELHO_CLASSE", "NU_REGISTRO", "SG_UF_CRM"],
    [UNIT_CODE, DOCTOR_SUS, "225125", "71", DOCTOR_CRM, "SP"],
    [UNIT_CODE, DOCTOR_SUS, "225125", "71", DOCTOR_CRM_RJ, "RJ"],
  ]);
}

async function purgeFixtures(database: AnyDatabase) {
  await database.execute(sql`
    delete from registry.facility_professional_occupations where facility_cnes_id = ${CNES_CODE};
  `);
  await database.execute(sql`
    delete from registry.facility_professionals where facility_cnes_id = ${CNES_CODE};
  `);
  await database.execute(sql`
    delete from registry.professional_registrations
      where professional_cnes_id in (${DOCTOR_SUS}, ${NURSE_SUS});
  `);
  await database.execute(sql`
    delete from registry.professionals where cnes_id in (${DOCTOR_SUS}, ${NURSE_SUS});
  `);
  await database.execute(
    sql`delete from registry.facilities where cnes_id in (${CNES_CODE}, ${STRANGER_CNES}, ${JUNK_COORDS_CNES});`
  );
  await database.execute(sql`delete from facilities where name = ${FACILITY_NAME};`);
  // The council row is NOT purged. It is hand-seeded reference data (ADR 0009 §6)
  // that a real load depends on, and by the time this suite runs beside real
  // registry data there are tens of thousands of registrations pointing at it.
}

/**
 * Seeds the council whitelist the loader reads but never writes (ADR 0009 §6).
 *
 * That the fixture has to do this is the point: the loader used to insert a
 * hardcoded list, and the export's own council catalogue is unreliable enough
 * that the table is curated by hand.
 */
async function seedCouncil(database: AnyDatabase) {
  await database.execute(sql`
    insert into registry.professional_councils (cnes_id, name, abbreviation, atlasmed_id)
      select ${COUNCIL_CNES_ID}, 'Conselho Regional de Medicina', 'CRM',
             (select id from person_professional_registration_councils
               where abbreviation = 'CRM' limit 1)
      on conflict (cnes_id) do nothing;
  `);
}

const ROLLBACK = Symbol("rollback");

/**
 * Runs a test body against the database, then throws it all away.
 *
 * Not politeness — necessity. The loader replaces the roster of **every** clinic
 * we operate, so a fixture that lists one clinic's staff legitimately empties the
 * other 1422. Run uncommitted against a database carrying a real load, this suite
 * deletes 25 000 vínculos, which is exactly what it did the first time.
 */
async function rolledBack(
  body: (tx: AnyDatabase) => Promise<void>
): Promise<void> {
  try {
    await db!.transaction(async (tx) => {
      await body(tx as unknown as AnyDatabase);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
}

async function professionalExists(
  database: AnyDatabase,
  cnesId: string
): Promise<boolean> {
  const rows = (await database.execute(sql`
    select count(*)::int as n from registry.professionals where cnes_id = ${cnesId};
  `)) as unknown as { n: number }[];
  return (rows[0]?.n ?? 0) > 0;
}

/**
 * Creates a person in `public` holding one council registration.
 *
 * Registrations hang off `person_healthcare_profiles`, not off `persons`, so the
 * profile is not optional scaffolding — it is what makes someone a professional
 * who can hold a CRM at all.
 */
async function seedPersonWithRegistration(
  database: AnyDatabase,
  input: { firstName: string; stateCode: string; registrationNumber: string }
): Promise<number> {
  await database.execute(sql`
    insert into persons (first_name, last_name) values (${input.firstName}, ${PERSON_MARK});
  `);
  const [person] = (await database.execute(sql`
    select id from persons where first_name = ${input.firstName} and last_name = ${PERSON_MARK} limit 1;
  `)) as unknown as { id: number | string }[];
  await database.execute(sql`
    insert into person_healthcare_profiles (person_id) values (${person!.id});
  `);
  await database.execute(sql`
    insert into person_professional_registrations (person_id, council_id, state_code, registration_number)
      select ${person!.id}, c.id, ${input.stateCode}, ${input.registrationNumber}
        from person_professional_registration_councils c
       where c.abbreviation = 'CRM' limit 1;
  `);
  // `persons.id` is a bigint, which this driver renders as a string.
  return Number(person!.id);
}

async function bridgeOf(
  database: AnyDatabase,
  cnesId: string
): Promise<number | null> {
  const rows = (await database.execute(sql`
    select atlasmed_id from registry.professionals where cnes_id = ${cnesId};
  `)) as unknown as { atlasmed_id: number | string | null }[];
  const raw = rows[0]?.atlasmed_id;
  // bigint arrives as a string from this driver.
  return raw === null || raw === undefined ? null : Number(raw);
}

async function vinculoCount(database: AnyDatabase): Promise<number> {
  const rows = (await database.execute(sql`
    select count(*)::int as n from registry.facility_professionals
      where facility_cnes_id = ${CNES_CODE};
  `)) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

describe.if(dbUp)("loadRegistryFromCsv", () => {
  beforeAll(async () => {
    await purgeFixtures(db!);
    await seedCouncil(db!);
    // Reuse a state/municipality if the database has them; a database migrated
    // from empty has neither, and `states.abbreviation` is a two-character UNIQUE,
    // so inventing one per run is a collision waiting to happen.
    await db!.execute(sql`
      insert into states (name, ibge_id, abbreviation)
        select 'CNES LOADER FIXTURE UF', '99', 'ZZ'
         where not exists (select 1 from states);
    `);
    await db!.execute(sql`
      insert into municipalities (state_id, name, ibge_id)
        select s.id, 'CNES LOADER FIXTURE', '9999999'
          from states s
         where not exists (select 1 from municipalities)
         limit 1;
    `);
    await db!.execute(sql`
      insert into facilities (name, location, legal_document_type, state_id, municipality_id, cnes_code)
        select ${FACILITY_NAME}, ST_SetSRID(ST_MakePoint(-46.63, -23.55), 4326), 'CNPJ',
               m.state_id, m.id, ${CNES_CODE}
          from municipalities m
         limit 1;
    `);
    buildDump("with-doctor", true);
    buildDump("without-doctor", false);
    buildDualUfDump("dual-uf");
    buildNationalDump("national");
  });

  afterAll(async () => {
    if (dbUp) await purgeFixtures(db!);
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Spec 0015 removed the `atlasmed_id` gate on establishments. These pin the
   * behaviour that replaced it — every one of them fails against the scoped
   * loader, because it wrote no row at all for a clinic we do not operate.
   */
  describe("mirroring establishments we do not operate", () => {
    async function registryRow(tx: AnyDatabase, cnesId: string) {
      const rows = (await tx.execute(sql`
        select atlasmed_id, municipality_cnes_id, managing_municipality_cnes_id,
               unit_type_code, unit_subtype_code, legal_person_type,
               maintainer_tax_id, latitude::text as latitude, longitude::text as longitude
          from registry.facilities where cnes_id = ${cnesId}
      `)) as unknown as Record<string, unknown>[];
      return rows[0] ?? null;
    }

    it("mirrors a clinic nobody operates, unbridged", async () => {
      await rolledBack(async (tx) => {
        await loadRegistryFromCsv({ db: tx, csvDir: join(dir, "national"), reference: REFERENCE });

        const stranger = await registryRow(tx, STRANGER_CNES);
        expect(stranger).not.toBeNull();
        expect(stranger!.atlasmed_id).toBeNull();
        // Unpadded in the export; the catalogue and every lookup use two digits.
        expect(stranger!.unit_type_code).toBe("05");
        expect(stranger!.legal_person_type).toBe("1");
        expect(stranger!.maintainer_tax_id).toBe("11222333000144");
      });
    });

    it("never clears the bridge of a facility that left the loader's scope", async () => {
      await rolledBack(async (tx) => {
        await loadRegistryFromCsv({ db: tx, csvDir: join(dir, "national"), reference: REFERENCE });
        const ours = await registryRow(tx, CNES_CODE);
        expect(ours!.atlasmed_id).not.toBeNull();

        /*
         * Deactivating the clinic drops it out of `atlasIdByCnes` — step 0 scopes
         * on `deactivated_at IS NULL` — so the next run carries a null
         * `atlasmed_id` for a row that has one. This is not hypothetical: all 19
         * deactivated facilities are in exactly this state, and a plain
         * `excluded.atlasmed_id` would wipe every one of their bridges while
         * reporting a clean load.
         */
        await tx.execute(
          sql`update facilities set deactivated_at = now() where name = ${FACILITY_NAME};`
        );
        await loadRegistryFromCsv({ db: tx, csvDir: join(dir, "national"), reference: REFERENCE });

        const again = await registryRow(tx, CNES_CODE);
        expect(again!.atlasmed_id).toBe(ours!.atlasmed_id);
      });
    });

    it("takes the município from CO_UNIDADE, keeping the gestor beside it", async () => {
      await rolledBack(async (tx) => {
        await loadRegistryFromCsv({ db: tx, csvDir: join(dir, "national"), reference: REFERENCE });
        const stranger = await registryRow(tx, STRANGER_CNES);
        // The two disagree in this fixture, which is the whole point: the
        // establishment's own município is the CO_UNIDADE prefix, not the gestor.
        expect(stranger!.municipality_cnes_id).toBe(STRANGER_OWN_MUNICIPALITY);
        expect(stranger!.managing_municipality_cnes_id).toBe(STRANGER_GESTOR);
      });
    });

    it("accepts comma decimals and refuses impossible coordinates", async () => {
      await rolledBack(async (tx) => {
        await loadRegistryFromCsv({ db: tx, csvDir: join(dir, "national"), reference: REFERENCE });

        // 992 values in the real export use a comma. Passed through untouched
        // they raise 22P02 and take the whole 1 000-row batch with them.
        const stranger = await registryRow(tx, STRANGER_CNES);
        expect(Number(stranger!.latitude)).toBeCloseTo(-13.8553786, 6);
        expect(Number(stranger!.longitude)).toBeCloseTo(-40.0838023, 6);

        // A latitude of 900 is not a bad coordinate, it is not a coordinate.
        const junk = await registryRow(tx, JUNK_COORDS_CNES);
        expect(junk).not.toBeNull();
        expect(junk!.latitude).toBeNull();
        expect(junk!.longitude).toBeNull();
      });
    });

    it("links the subtype from rlEstabSubTipo", async () => {
      await rolledBack(async (tx) => {
        await loadRegistryFromCsv({ db: tx, csvDir: join(dir, "national"), reference: REFERENCE });
        const ours = await registryRow(tx, CNES_CODE);
        expect(ours!.unit_subtype_code).toBe("009");
        // No row in rlEstabSubTipo for this one — absent, not invented.
        const stranger = await registryRow(tx, STRANGER_CNES);
        expect(stranger!.unit_subtype_code).toBeNull();
      });
    });

    it("loads the establishment catalogues", async () => {
      await rolledBack(async (tx) => {
        const result = await loadRegistryFromCsv({
          db: tx, csvDir: join(dir, "national"), reference: REFERENCE,
        });
        expect(result.auxUnitTypes).toBe(2);
        expect(result.auxUnitSubtypes).toBe(1);
        expect(result.auxDeactivationReasons).toBe(1);
        expect(result.establishmentSubtypes).toBe(1);
      });
    });
  });

  it("drops a departed doctor even when the clinic reports no doctor at all", async () => {
    await rolledBack(async (tx) => {
      const first = await loadRegistryFromCsv({
        db: tx,
        csvDir: join(dir, "with-doctor"),
        reference: REFERENCE,
      });
      expect(first.vinculos).toBe(1);
      expect(await vinculoCount(tx)).toBe(1);
      // The gestor município resolves against the catalogue rather than being
      // dropped on the floor, which is what it was before.
      expect(first.facilitiesWithoutMunicipality).toBe(0);
      const located = (await tx.execute(sql`
        select municipality_cnes_id from registry.facilities where cnes_id = ${CNES_CODE};
      `)) as unknown as { municipality_cnes_id: string | null }[];
      expect(located[0]?.municipality_cnes_id).toBe("355030");

      const second = await loadRegistryFromCsv({
        db: tx,
        csvDir: join(dir, "without-doctor"),
        reference: REFERENCE,
      });
      expect(second.vinculos).toBe(0);
      // The clinic is absent from this run's `staffByFacility`; scoping the delete
      // there left the doctor suggested forever.
      expect(await vinculoCount(tx)).toBe(0);
      // The person survives — absence is not departure, and the bridge is theirs.
      expect(await professionalExists(tx, DOCTOR_SUS)).toBe(true);
    });
  });

  it("imports on the registration, not the CBO", async () => {
    await rolledBack(async (tx) => {
      // The nurse's row carries a CBO the catalogue knows but no NU_REGISTRO, so
      // nobody qualifies — the old CBO-prefix gate would have imported the doctor
      // here and excluded the nurse on occupation alone.
      const result = await loadRegistryFromCsv({
        db: tx,
        csvDir: join(dir, "without-doctor"),
        reference: REFERENCE,
      });
      expect(result.cargaRowsWithoutRegistration).toBe(1);
      expect(result.professionalsSeen).toBe(0);
      expect(await professionalExists(tx, NURSE_SUS)).toBe(false);
    });
  });

  /**
   * These run against a database that already carries a real load, where the
   * bridge legitimately links ~1 000 people on its first pass. Asserting an
   * absolute count would measure that ambient data, not the fixture.
   *
   * So every test loads once to absorb the ambient matches, seeds its person,
   * and loads again — the second run's counters describe the fixture alone,
   * because the bridge only considers rows still unlinked. It is also the real
   * sequence: a person exists in `public`, and the *next* month's load finds
   * them.
   */
  describe("bridging registry professionals to people we already hold", () => {
    async function warmUp(tx: AnyDatabase, subdir = "with-doctor") {
      await loadRegistryFromCsv({
        db: tx,
        csvDir: join(dir, subdir),
        reference: REFERENCE,
      });
    }

    it("links on the council registration", async () => {
      await rolledBack(async (tx) => {
        await warmUp(tx);
        // A doctor a rep entered by hand: a CRM, and no CNES identifier of any
        // kind. This is what every manually-added professional looks like, and
        // the SUS-id join can never find them.
        const personId = await seedPersonWithRegistration(tx, {
          firstName: "Bridged",
          stateCode: "SP",
          registrationNumber: DOCTOR_CRM,
        });

        const result = await loadRegistryFromCsv({
          db: tx,
          csvDir: join(dir, "with-doctor"),
          reference: REFERENCE,
        });

        expect(result.professionalsBridged).toBe(1);
        expect(await bridgeOf(tx, DOCTOR_SUS)).toBe(personId);
      });
    });

    it("leaves a professional unlinked when nobody holds the registration", async () => {
      await rolledBack(async (tx) => {
        await warmUp(tx);
        const result = await loadRegistryFromCsv({
          db: tx,
          csvDir: join(dir, "with-doctor"),
          reference: REFERENCE,
        });

        expect(result.professionalsBridged).toBe(0);
        expect(await bridgeOf(tx, DOCTOR_SUS)).toBeNull();
      });
    });

    it("never overwrites a link someone set by hand", async () => {
      await rolledBack(async (tx) => {
        await warmUp(tx);
        // Someone decided this registry row belongs to a different person than
        // the registration implies — a correction, and the only reason to touch
        // the column by hand. A monthly job that reverts it is worse than one
        // that never ran.
        const corrected = await seedPersonWithRegistration(tx, {
          firstName: "Corrected",
          stateCode: "RJ",
          registrationNumber: "9900000",
        });
        await seedPersonWithRegistration(tx, {
          firstName: "Automatic",
          stateCode: "SP",
          registrationNumber: DOCTOR_CRM,
        });
        await tx.execute(sql`
          update registry.professionals set atlasmed_id = ${corrected}
           where cnes_id = ${DOCTOR_SUS};
        `);

        const result = await loadRegistryFromCsv({
          db: tx,
          csvDir: join(dir, "with-doctor"),
          reference: REFERENCE,
        });

        expect(result.professionalsBridged).toBe(0);
        expect(await bridgeOf(tx, DOCTOR_SUS)).toBe(corrected);
      });
    });

    it("refuses to guess when one professional matches two people", async () => {
      await rolledBack(async (tx) => {
        await warmUp(tx, "dual-uf");
        // Dual-UF registration where each state's CRM belongs to a different
        // person on our side. One of the two records is wrong, and picking
        // either would attach a clinic's roster to the wrong doctor.
        await seedPersonWithRegistration(tx, {
          firstName: "Paulista",
          stateCode: "SP",
          registrationNumber: DOCTOR_CRM,
        });
        await seedPersonWithRegistration(tx, {
          firstName: "Carioca",
          stateCode: "RJ",
          registrationNumber: DOCTOR_CRM_RJ,
        });

        const result = await loadRegistryFromCsv({
          db: tx,
          csvDir: join(dir, "dual-uf"),
          reference: REFERENCE,
        });

        expect(result.professionalsBridged).toBe(0);
        // Counted rather than silently skipped: an unresolved match is a data
        // problem someone can go and look at.
        expect(result.professionalsBridgeAmbiguous).toBe(2);
        expect(await bridgeOf(tx, DOCTOR_SUS)).toBeNull();
      });
    });

    it("skips a person another professional already reaches by SUS id", async () => {
      await rolledBack(async (tx) => {
        await warmUp(tx);
        // This person is already resolvable from the *nurse's* registry row via
        // `cnes_professional_id`. Bridging the doctor's row to them as well would
        // put one human in the suggestion list twice, once by each route.
        const personId = await seedPersonWithRegistration(tx, {
          firstName: "Already Reachable",
          stateCode: "SP",
          registrationNumber: DOCTOR_CRM,
        });
        await tx.execute(sql`
          update person_healthcare_profiles set cnes_professional_id = ${NURSE_SUS}
           where person_id = ${personId};
        `);

        const result = await loadRegistryFromCsv({
          db: tx,
          csvDir: join(dir, "with-doctor"),
          reference: REFERENCE,
        });

        expect(result.professionalsBridged).toBe(0);
        expect(await bridgeOf(tx, DOCTOR_SUS)).toBeNull();
      });
    });

    it("ignores a registration its owner deactivated", async () => {
      await rolledBack(async (tx) => {
        await warmUp(tx);
        const personId = await seedPersonWithRegistration(tx, {
          firstName: "Deactivated",
          stateCode: "SP",
          registrationNumber: DOCTOR_CRM,
        });
        // A registration someone switched off is one they disowned; resting an
        // identity claim on it re-asserts what they retracted.
        await tx.execute(sql`
          update person_professional_registrations set is_active = false
           where person_id = ${personId};
        `);

        const result = await loadRegistryFromCsv({
          db: tx,
          csvDir: join(dir, "with-doctor"),
          reference: REFERENCE,
        });

        expect(result.professionalsBridged).toBe(0);
        expect(await bridgeOf(tx, DOCTOR_SUS)).toBeNull();
      });
    });
  });

  /**
   * Emptying the council table is destructive — against a database carrying a
   * real load it means deleting tens of thousands of registrations to get past
   * `ON DELETE restrict`. So the whole assertion runs inside a transaction that
   * is always rolled back: the loader throws before it opens a transaction of its
   * own, and the throw aborts this one.
   */
  it("refuses to run when no council has been seeded", async () => {
    await expect(
      db!.transaction(async (tx) => {
        await tx.execute(sql`delete from registry.professional_registrations;`);
        await tx.execute(sql`delete from registry.professional_councils;`);
        await loadRegistryFromCsv({
          db: tx,
          csvDir: join(dir, "with-doctor"),
          reference: REFERENCE,
        });
      })
      // Silently importing nobody would look identical to a clean run.
    ).rejects.toThrow(/professional_councils is empty/);

    // The rollback must have put everything back.
    const councils = (await db!.execute(sql`
      select count(*)::int as n from registry.professional_councils;
    `)) as unknown as { n: number }[];
    expect(councils[0]!.n).toBeGreaterThan(0);
  });

  it("refuses to load when the export is missing a column it reads", async () => {
    const broken = join(dir, "broken");
    cpSync(join(dir, "with-doctor"), broken, { recursive: true });
    // `NO_PROFISSIONAL` gone: without a preflight this loads every doctor named
    // after their SUS id and reports success.
    writeFileSync(
      join(broken, "tbDadosProfissionalSus202605.csv"),
      Buffer.from("CO_PROFISSIONAL_SUS;CO_CNS;CO_CPF\r\n", "latin1")
    );

    await expect(
      loadRegistryFromCsv({ db: db!, csvDir: broken, reference: REFERENCE })
    ).rejects.toThrow(/NO_PROFISSIONAL/);
  });
});
