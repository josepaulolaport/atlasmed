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
const FACILITY_NAME = "T-CNES-LOADER fixture";
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
  writeCsv(subdir, "tbEstabelecimento", [
    [
      "CO_UNIDADE",
      "CO_CNES",
      "NO_RAZAO_SOCIAL",
      "NO_FANTASIA",
      "TP_UNIDADE",
      "CO_MUNICIPIO_GESTOR",
    ],
    [UNIT_CODE, CNES_CODE, "CLINICA FIXTURE LTDA", "CLINICA FIXTURE", "36", "355030"],
  ]);
  writeCsv(subdir, "tbDadosProfissionalSus", [
    ["CO_PROFISSIONAL_SUS", "NO_PROFISSIONAL", "CO_CNS", "CO_CPF"],
    [DOCTOR_SUS, "DOUTOR FIXTURE", "700000000009901", "XXX.392.286.XX"],
    [NURSE_SUS, "ENFERMEIRO FIXTURE", "700000000009902", "XXX.111.222.XX"],
  ]);
  writeCsv(subdir, "tbCargaHorariaSus", [
    ["CO_UNIDADE", "CO_PROFISSIONAL_SUS", "CO_CBO", "CO_CONSELHO_CLASSE", "NU_REGISTRO", "SG_UF_CRM"],
    withDoctor
      ? [UNIT_CODE, DOCTOR_SUS, "225125", "71", "9912345", "SP"]
      : [UNIT_CODE, NURSE_SUS, "223505", "71", "", ""],
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
  await database.execute(sql`delete from registry.facilities where cnes_id = ${CNES_CODE};`);
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
  });

  afterAll(async () => {
    if (dbUp) await purgeFixtures(db!);
    rmSync(dir, { recursive: true, force: true });
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
