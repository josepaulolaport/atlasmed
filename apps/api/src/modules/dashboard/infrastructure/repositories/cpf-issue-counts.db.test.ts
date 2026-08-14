import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import { DrizzleFacilityRepository } from "../../../facility/infrastructure/repositories/drizzle/drizzle-facility.repository";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";
import type { DashboardProfileFilter } from "../../application/dashboard-query";

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
  municipalityId: number;
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

  const municipality = await scalar<{ id: number | string }>(
    db.execute(
      sql`select id from municipalities where ibge_id = ${MUNICIPALITY_IBGE};`
    )
  );

  return {
    verticalA,
    verticalB,
    municipalityId: Number(municipality.id),
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

  /** The scope every metric takes (spec 0014 §4), narrowed to one linha. */
  function filter(
    verticalId: number,
    overrides: Partial<DashboardProfileFilter> = {},
  ): DashboardProfileFilter {
    return {
      verticalId,
      zoneIds: null,
      repUserIds: null,
      stateIds: null,
      municipalityIds: null,
      unitTypeIds: null,
      ...overrides,
    };
  }

  it("counts a blank document as missing and a bad checksum as invalid", async () => {
    const counts = await repository.countCpfIssues(filter(fixture.verticalA));

    // twoLinhas and blank, not the valid one and not the bad-checksum one.
    expect(counts).toEqual({ missing: 2, invalid: 1 });
  });

  it("counts a clinic once however many linhas it sells", async () => {
    // The clinic in both linhas has one CPF. The count is per linha, so it
    // contributes exactly one to each — never two to either, which is what
    // `COUNT(DISTINCT facilities.id)` guards.
    const a = await repository.countCpfIssues(filter(fixture.verticalA));
    const b = await repository.countCpfIssues(filter(fixture.verticalB));

    expect(a.missing).toBe(2);
    expect(b).toEqual({ missing: 1, invalid: 0 });
  });

  it("pins one linha rather than counting across them", async () => {
    // Spec 0014 §3. The bad-checksum clinic sells only linha A, so it must not
    // reach a reader looking at linha B.
    const counts = await repository.countCpfIssues(filter(fixture.verticalB));

    expect(counts.invalid).toBe(0);
  });

  it("follows the same geography filter as the cards beside it", async () => {
    // Without this the warning counts the whole country while the donut next to
    // it counts one state, and the rep has no way to tell which is wrong.
    const inside = await repository.countCpfIssues(
      filter(fixture.verticalA, { municipalityIds: [fixture.municipalityId] }),
    );
    const elsewhere = await repository.countCpfIssues(
      filter(fixture.verticalA, { municipalityIds: [-1] }),
    );

    expect(inside).toEqual({ missing: 2, invalid: 1 });
    expect(elsewhere).toEqual({ missing: 0, invalid: 0 });
  });

  it("ignores inactive profiles and deactivated clinics", async () => {
    // Both are seeded with no document, so either leaking would push `missing`
    // past 2.
    const counts = await repository.countCpfIssues(filter(fixture.verticalA));

    expect(counts.missing).toBe(2);
  });

  it("matches nothing — not everything — for an empty scope", async () => {
    // An empty zone list means "nothing in scope". Reading it as "no
    // restriction" is how a scoped user ends up seeing global numbers.
    await expect(
      repository.countCpfIssues(filter(fixture.verticalA, { zoneIds: [] })),
    ).resolves.toEqual({ missing: 0, invalid: 0 });
  });

  it("agrees with the list the warning opens", async () => {
    /**
     * The property a rep actually notices.
     *
     * The card says "2 sem CPF" and tapping it opens `GET /facilities` with
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

    // The list spans both linhas, so the counts it is compared against are the
    // union of the two — a clinic in both must still be one clinic.
    const [a, b] = await Promise.all([
      repository.countCpfIssues(filter(fixture.verticalA)),
      repository.countCpfIssues(filter(fixture.verticalB)),
    ]);
    const union = {
      // twoLinhas is missing in both, so a naive sum would say 3.
      missing: a.missing + b.missing - 1,
      invalid: a.invalid + b.invalid,
    };

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

      expect(onlyOurs).toHaveLength(union[cpfStatus]);
      // `total` drives the list's paging; if it disagreed with the rows the
      // last page would be empty or unreachable.
      expect(total).toBe(listed.length);
    }
  });
});
