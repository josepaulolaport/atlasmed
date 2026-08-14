import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import { DrizzleFacilityRepository } from "../../../facility/infrastructure/repositories/drizzle/drizzle-facility.repository";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";

/**
 * The Desempenho CPF counts, against real rows.
 *
 * Rendered SQL can show the query mentions the right columns. Only rows can
 * show it returns the right numbers, and the two ways this can be quietly
 * wrong are both invisible in the SQL text:
 *
 *   - a clinic selling two linhas counted twice, so the warning says 3 and the
 *     list it opens holds 2;
 *   - the facility restriction dropped, so a rep is warned about clinics they
 *     cannot open.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-CPF-COUNT";
const STATE_IBGE = "9994";
const MUNICIPALITY_IBGE = "99940001";
const repository = new DrizzleDashboardRepository();
const facilityRepository = new DrizzleFacilityRepository();

const VALID_CPF = "52998224725";
const INVALID_CPF = "52998224724";

interface Fixture {
  verticalA: number;
  verticalB: number;
  /** CPF, no document, active in both linhas — the double-count trap. */
  twoLinhas: number;
  /** CPF, blank document, linha A only. */
  blank: number;
  /** CPF, bad checksum, linha A only. */
  invalid: number;
  /** CPF, good document — must not be counted at all. */
  fine: number;
  /** CPF, no document, but its profile is inactive. */
  inactiveProfile: number;
  /** CPF, no document, but the clinic is deactivated. */
  deactivated: number;
}

async function purge() {
  await db.execute(sql`
    delete from facility_vertical_profiles where facility_id in (
      select id from facilities where name like ${`${MARK}%`});
  `);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(sql`delete from business_verticals where code like ${`${MARK}%`};`);
  await db.execute(sql`
    delete from municipalities
     where ibge_id = ${MUNICIPALITY_IBGE}
        or state_id in (
          select id from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZE'
        );
  `);
  await db.execute(
    sql`delete from states where ibge_id = ${STATE_IBGE} or abbreviation = 'ZE';`
  );
}

async function scalar<T>(query: Promise<unknown>): Promise<T> {
  const rows = (await query) as unknown as T[];
  const first = rows[0];
  if (!first) throw new Error("fixture row was not created");
  return first;
}

async function makeFacility(input: {
  name: string;
  document: string | null;
  deactivated?: boolean;
}): Promise<number> {
  const row = await scalar<{ id: number | string }>(
    db.execute(sql`
      insert into facilities
        (name, cnes_code, location, legal_document_type, legal_document, state_id, municipality_id, deactivated_at)
        select ${input.name}, ${crypto.randomUUID()},
               ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326),
               'CPF'::facility_legal_document_type, ${input.document},
               m.state_id, m.id, ${input.deactivated ? sql`now()` : sql`null`}
          from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE}
        returning id;
    `)
  );
  return Number(row.id);
}

async function linkVertical(
  facilityId: number,
  verticalId: number,
  isActive = true,
) {
  await db.execute(sql`
    insert into facility_vertical_profiles (facility_id, vertical_id, is_active)
      values (${facilityId}, ${verticalId}, ${isActive});
  `);
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      values ('T-CPFC UF', ${STATE_IBGE}, 'ZE') on conflict do nothing;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-CPFC City', ${MUNICIPALITY_IBGE}
        from states s where s.ibge_id = ${STATE_IBGE}
      on conflict do nothing;
  `);

  const verticalA = Number(
    (
      await scalar<{ id: number | string }>(
        db.execute(sql`
          insert into business_verticals (code, name)
            values (${`${MARK}-A`}, ${`${MARK}-A`}) returning id;
        `)
      )
    ).id
  );
  const verticalB = Number(
    (
      await scalar<{ id: number | string }>(
        db.execute(sql`
          insert into business_verticals (code, name)
            values (${`${MARK}-B`}, ${`${MARK}-B`}) returning id;
        `)
      )
    ).id
  );

  const twoLinhas = await makeFacility({
    name: `${MARK} DUAS LINHAS`,
    document: null,
  });
  await linkVertical(twoLinhas, verticalA);
  await linkVertical(twoLinhas, verticalB);

  const blank = await makeFacility({ name: `${MARK} BRANCO`, document: "  " });
  await linkVertical(blank, verticalA);

  const invalid = await makeFacility({
    name: `${MARK} INVALIDO`,
    document: INVALID_CPF,
  });
  await linkVertical(invalid, verticalA);

  const fine = await makeFacility({ name: `${MARK} OK`, document: VALID_CPF });
  await linkVertical(fine, verticalA);

  const inactiveProfile = await makeFacility({
    name: `${MARK} PERFIL INATIVO`,
    document: null,
  });
  await linkVertical(inactiveProfile, verticalA, false);

  const deactivated = await makeFacility({
    name: `${MARK} DESATIVADA`,
    document: null,
    deactivated: true,
  });
  await linkVertical(deactivated, verticalA);

  return {
    verticalA,
    verticalB,
    twoLinhas,
    blank,
    invalid,
    fine,
    inactiveProfile,
    deactivated,
  };
}

describe.if(dbUp)("countCpfIssues", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  it("counts a clinic once however many linhas it sells", async () => {
    // The bucket counts count profiles, so this clinic contributes two rows
    // there. Counting rows here would report 3 missing where the list opens 2.
    const counts = await repository.countCpfIssues({
      verticalIds: [fixture.verticalA, fixture.verticalB],
      facilityIds: null,
    });

    expect(counts.missing).toBe(2); // twoLinhas + blank
    expect(counts.invalid).toBe(1);
  });

  it("counts a blank document as missing and a bad checksum as invalid", async () => {
    const counts = await repository.countCpfIssues({
      verticalIds: [fixture.verticalA],
      facilityIds: null,
    });

    // twoLinhas and blank, not the valid one and not the bad-checksum one.
    expect(counts.missing).toBe(2);
    expect(counts.invalid).toBe(1);
  });

  it("follows the Linha filter", async () => {
    // Only the two-linha clinic is in B, and it has no document.
    const counts = await repository.countCpfIssues({
      verticalIds: [fixture.verticalB],
      facilityIds: null,
    });

    expect(counts).toEqual({ missing: 1, invalid: 0 });
  });

  it("honours a restricted facility set", async () => {
    // Without this a rep would be warned about clinics they cannot open.
    const counts = await repository.countCpfIssues({
      verticalIds: [fixture.verticalA, fixture.verticalB],
      facilityIds: [fixture.invalid],
    });

    expect(counts).toEqual({ missing: 0, invalid: 1 });
  });

  it("ignores inactive profiles and deactivated clinics", async () => {
    const counts = await repository.countCpfIssues({
      verticalIds: [fixture.verticalA, fixture.verticalB],
      facilityIds: [fixture.inactiveProfile, fixture.deactivated],
    });

    expect(counts).toEqual({ missing: 0, invalid: 0 });
  });

  it("agrees with the list the warning opens", async () => {
    /**
     * The property a rep actually notices.
     *
     * The card says "3 sem CPF" and tapping it opens `GET /facilities` with
     * `cpfStatus=missing`. These are two different queries against two
     * different builders — the count joins `facility_vertical_profiles` and
     * counts distinct facilities, the list applies `buildFacilityListConditions`
     * with a scope filter — and nothing but this test makes them return the
     * same set. A disagreement is silently wrong in the worst way: both
     * screens look fine on their own.
     */
    const verticalIds = [fixture.verticalA, fixture.verticalB];
    const listScope = {
      isGlobal: true,
      verticalIds,
      restrictToVerticalProfiles: true,
    } as unknown as Parameters<typeof facilityRepository.findAll>[0]["scope"];

    const counts = await repository.countCpfIssues({
      verticalIds,
      facilityIds: null,
    });

    for (const cpfStatus of ["missing", "invalid"] as const) {
      const { facilities: listed, total } = await facilityRepository.findAll({
        page: 1,
        limit: 100,
        cpfStatus,
        userId: 1,
        scope: listScope,
      });
      const onlyOurs = listed.filter((facility) =>
        facility.name.startsWith(MARK),
      );

      expect(onlyOurs).toHaveLength(counts[cpfStatus]);
      // `total` drives the list's paging; if it disagreed with the rows the
      // last page would be empty or unreachable.
      expect(total).toBe(listed.length);
    }
  });

  it("returns zeros for an empty scope rather than counting everything", async () => {
    // An empty facility set means "nothing in scope". Reading it as "no
    // restriction" is how a scoped user ends up seeing global numbers.
    await expect(
      repository.countCpfIssues({ verticalIds: [fixture.verticalA], facilityIds: [] }),
    ).resolves.toEqual({ missing: 0, invalid: 0 });
    await expect(
      repository.countCpfIssues({ verticalIds: [], facilityIds: null }),
    ).resolves.toEqual({ missing: 0, invalid: 0 });
  });
});
