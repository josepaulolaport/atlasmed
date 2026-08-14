import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleFacilityRepository } from "./drizzle-facility.repository";

/**
 * `cpfStatus` against real rows.
 *
 * A rendered-SQL test says the condition mentions the right columns; only rows
 * say it selects the right clinics. The two failure modes here are quiet ones:
 * a blank document counted as present (so a clinic missing its CPF never
 * appears in the list a rep opens to fix it), and the two sets overlapping (so
 * one clinic is reported under both counts and the totals do not add up).
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-CPF-STATUS";
/** Four-digit UF and eight-digit município put these outside real IBGE codes. */
const STATE_IBGE = "9993";
const MUNICIPALITY_IBGE = "99930001";
const repository = new DrizzleFacilityRepository();

const VALID_CPF = "52998224725";
const INVALID_CPF = "52998224724";

interface Fixture {
  nullDoc: number;
  blankDoc: number;
  invalidDoc: number;
  validDoc: number;
  cnpjNullDoc: number;
  cnpjRealDoc: number;
}

async function purge() {
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(sql`
    delete from municipalities
     where ibge_id = ${MUNICIPALITY_IBGE}
        or state_id in (
          select id from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZD'
        );
  `);
  await db.execute(
    sql`delete from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZD';`
  );
}

async function makeFacility(input: {
  name: string;
  type: "CPF" | "CNPJ";
  document: string | null;
}): Promise<number> {
  await db.execute(sql`
    insert into facilities (name, cnes_code, location, legal_document_type, legal_document, state_id, municipality_id)
      select ${input.name}, ${crypto.randomUUID()},
             ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326),
             ${input.type}::facility_legal_document_type, ${input.document}, m.state_id, m.id
        from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE};
  `);
  const [row] = (await db.execute(sql`
    select id from facilities where name = ${input.name} limit 1;
  `)) as unknown as { id: number | string }[];
  if (!row) throw new Error(`fixture facility ${input.name} was not created`);
  return Number(row.id);
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      values ('T-CPF UF', ${STATE_IBGE}, 'ZD') on conflict do nothing;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-CPF City', ${MUNICIPALITY_IBGE}
        from states s where s.ibge_id = ${STATE_IBGE}
      on conflict do nothing;
  `);

  return {
    nullDoc: await makeFacility({
      name: `${MARK} SEM DOC`,
      type: "CPF",
      document: null,
    }),
    blankDoc: await makeFacility({
      // Whitespace, not empty: an imported blank is what the app already
      // renders as "—", and it is the case a naive `IS NULL` check misses.
      name: `${MARK} DOC EM BRANCO`,
      type: "CPF",
      document: "   ",
    }),
    invalidDoc: await makeFacility({
      name: `${MARK} DOC INVALIDO`,
      type: "CPF",
      document: INVALID_CPF,
    }),
    validDoc: await makeFacility({
      name: `${MARK} DOC VALIDO`,
      type: "CPF",
      document: VALID_CPF,
    }),
    cnpjNullDoc: await makeFacility({
      name: `${MARK} CNPJ SEM DOC`,
      type: "CNPJ",
      document: null,
    }),
    /**
     * A CNPJ clinic with a perfectly good CNPJ on file.
     *
     * The one row that proves the `invalid` branch is scoped by document type
     * rather than by the blank guard alone. `is_valid_cpf` says false for any
     * 14-digit number — correctly, it is not a CPF — so without the type
     * condition every CNPJ clinic in the database lands in "CPF inválido".
     * Every other CNPJ fixture here has a null document, which the blank guard
     * excludes on its own, so none of them can catch that.
     */
    cnpjRealDoc: await makeFacility({
      name: `${MARK} CNPJ COM DOC`,
      type: "CNPJ",
      document: "12345678000195",
    }),
  };
}

const globalScope = {
  isGlobal: true,
  facilityIds: [],
} as unknown as Parameters<typeof repository.findAll>[0]["scope"];

async function idsFor(cpfStatus: "missing" | "invalid"): Promise<number[]> {
  const { facilities } = await repository.findAll({
    page: 1,
    limit: 100,
    cpfStatus,
    userId: 1,
    scope: globalScope,
  });
  return facilities.map((facility) => facility.id);
}

describe.if(dbUp)("cpfStatus filter", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  it("counts a blank document as missing, not as present", async () => {
    const ids = await idsFor("missing");

    expect(ids).toContain(fixture.nullDoc);
    expect(ids).toContain(fixture.blankDoc);
  });

  it("leaves clinics that have a CPF out of missing", async () => {
    const ids = await idsFor("missing");

    expect(ids).not.toContain(fixture.validDoc);
    // Present but wrong is a different problem with a different fix.
    expect(ids).not.toContain(fixture.invalidDoc);
  });

  it("finds a CPF that fails the checksum", async () => {
    const ids = await idsFor("invalid");

    expect(ids).toContain(fixture.invalidDoc);
    expect(ids).not.toContain(fixture.validDoc);
  });

  it("never reports the same clinic as both missing and invalid", async () => {
    // The two counts sit side by side on Desempenho; if they overlapped, their
    // sum would exceed the number of clinics with a problem and neither number
    // could be trusted.
    const [missing, invalid] = await Promise.all([
      idsFor("missing"),
      idsFor("invalid"),
    ]);

    expect(missing.filter((id) => invalid.includes(id))).toEqual([]);
    expect(invalid).not.toContain(fixture.nullDoc);
    expect(invalid).not.toContain(fixture.blankDoc);
  });

  it("ignores CNPJ clinics entirely, even with no document", async () => {
    // A CNPJ clinic with no CNPJ is a real problem, but not the one this
    // warning counts — including it would make the number disagree with its
    // own label.
    const [missing, invalid] = await Promise.all([
      idsFor("missing"),
      idsFor("invalid"),
    ]);

    expect(missing).not.toContain(fixture.cnpjNullDoc);
    expect(invalid).not.toContain(fixture.cnpjNullDoc);

    // The row that actually pins the type scoping: it has a document, so the
    // blank guard does not exclude it, and `is_valid_cpf` says false for any
    // 14-digit number. Only `legal_document_type = 'CPF'` keeps it out.
    expect(invalid).not.toContain(fixture.cnpjRealDoc);
    expect(missing).not.toContain(fixture.cnpjRealDoc);
  });
});
