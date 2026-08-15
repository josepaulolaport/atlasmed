import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import type { DashboardProfileFilter } from "../../application/dashboard-query";
import { metricPredicateForTest } from "../../application/use-cases/dashboard-metrics.use-cases";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";

/**
 * "Clínicas atribuídas" and "Clínicas não atribuídas" over rows this test owns.
 *
 * The defect: the first card counted every clinic in scope and ignored the
 * assignment entirely, so an admin read "2374 atribuídas" beside "941 sem
 * representante" — the same clinics, counted twice, under two labels that
 * contradict each other. Neither number was wrong on its own, which is why it
 * survived: only reading them together shows it.
 *
 * Its neighbour [card-and-drilldown-agree.db.test.ts] asserts the same property
 * but seeds nothing, so on a migrations-only database every count is 0 and each
 * assertion holds trivially. This one brings a clinic *with* a rep and a clinic
 * *without* one, so 0 == 0 cannot pass for agreement.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-ASSIGNED-PARTITION";
const STATE_IBGE = "9993";
const MUNICIPALITY_IBGE = "99930001";
const VERTICAL_CODE = "T_ASSGN";
const ROLE_NAME = "T-ASSIGNED-PARTITION ROLE";
const repository = new DrizzleDashboardRepository();

interface Fixture {
  verticalId: number;
  assignedProfileId: number;
  unassignedProfileId: number;
}

async function purge() {
  await db.execute(sql`
    delete from facility_vertical_rep_assignments
     where facility_vertical_profile_id in (
       select p.id from facility_vertical_profiles p
         join facilities f on f.id = p.facility_id
        where f.name like ${`${MARK}%`}
     );
  `);
  await db.execute(sql`
    delete from facility_vertical_profiles where facility_id in (
      select id from facilities where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(
    sql`delete from business_verticals where code = ${VERTICAL_CODE};`,
  );
  await db.execute(
    sql`delete from users where email = ${`${MARK}@example.test`};`,
  );
  await db.execute(sql`delete from roles where name = ${ROLE_NAME};`);
  await db.execute(sql`
    delete from municipalities
     where ibge_id = ${MUNICIPALITY_IBGE}
        or state_id in (select id from states where ibge_id = ${STATE_IBGE});
  `);
  await db.execute(sql`delete from states where ibge_id = ${STATE_IBGE};`);
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const [row] = (await db.execute(query)) as unknown as { id: number }[];
  if (!row) throw new Error("fixture row was not created");
  return Number(row.id);
}

async function seedFacility(suffix: string, cnes: string): Promise<number> {
  // cnes_code is NOT NULL and unique among live facilities since the CNES
  // cutover, hence a code no real establishment can hold.
  return scalar(sql`
    insert into facilities (name, cnes_code, location, legal_document_type, state_id, municipality_id)
      select ${`${MARK} ${suffix}`}, ${cnes},
             ST_SetSRID(ST_MakePoint(-43.2, -22.9), 4326),
             'CNPJ'::facility_legal_document_type, m.state_id, m.id
        from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE}
      returning id;
  `);
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      values ('T-ASSGN UF', ${STATE_IBGE}, 'ZG') on conflict do nothing;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-ASSGN City', ${MUNICIPALITY_IBGE} from states s
       where s.ibge_id = ${STATE_IBGE} on conflict do nothing;
  `);

  const verticalId = await scalar(sql`
    insert into business_verticals (code, name)
      values (${VERTICAL_CODE}, 'T-ASSGN Vertical') returning id;
  `);

  // Brings its own role: `users.role_id` is NOT NULL, and selecting one out of
  // `roles` makes the fixture depend on a seeded database — true of a
  // production clone, false on CI, where the schema is migrations-only.
  const roleId = await scalar(sql`
    insert into roles (name, description)
      values (${ROLE_NAME}, 'Fixture role for assigned-clinics partition tests')
      returning id;
  `);
  const repUserId = await scalar(sql`
    insert into users (email, username, password_hash, first_name, last_name, role_id)
      values (${`${MARK}@example.test`}, ${`${MARK}-user`}, 'x', 'Rita', 'Sales', ${roleId})
      returning id;
  `);

  const assignedProfileId = await scalar(sql`
    insert into facility_vertical_profiles (facility_id, vertical_id, is_active)
      values (${await seedFacility("COM REP", "T9993001")}, ${verticalId}, true)
      returning id;
  `);
  const unassignedProfileId = await scalar(sql`
    insert into facility_vertical_profiles (facility_id, vertical_id, is_active)
      values (${await seedFacility("SEM REP", "T9993002")}, ${verticalId}, true)
      returning id;
  `);

  await db.execute(sql`
    insert into facility_vertical_rep_assignments (facility_vertical_profile_id, user_id)
      values (${assignedProfileId}, ${repUserId});
  `);
  // A closed assignment on the other one, so "has ever had a rep" and "has a
  // rep now" cannot be confused: this clinic must count as unassigned.
  await db.execute(sql`
    insert into facility_vertical_rep_assignments (facility_vertical_profile_id, user_id, started_at, ended_at)
      values (${unassignedProfileId}, ${repUserId}, now() - interval '30 days', now() - interval '1 day');
  `);

  return { verticalId, assignedProfileId, unassignedProfileId };
}

describe.if(dbUp)("atribuídas and não atribuídas partition the scope", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  const scope = (): DashboardProfileFilter => ({
    verticalId: fixture.verticalId,
    zoneIds: null,
    repUserIds: null,
    stateIds: null,
    municipalityIds: null,
    unitTypeIds: null,
  });

  const drillDownTotal = async (
    metric: Parameters<typeof metricPredicateForTest>[0],
  ): Promise<number> => {
    const { total } = await repository.listScopedClinics({
      filter: scope(),
      predicate: metricPredicateForTest(metric),
      offset: 0,
      limit: 1,
    });
    return total;
  };

  it("counts only the clinic that holds an open rep assignment", async () => {
    // The whole defect in one assertion: the scope holds 2 clinics, and this
    // card counted 2 before. A closed assignment is not a rep.
    expect(await repository.countProfilesWithRep(scope())).toBe(1);
    expect(await repository.countProfiles(scope())).toBe(2);
  });

  it("splits the scope exactly in two, leaving nothing over", async () => {
    const [withRep, withoutRep, total] = await Promise.all([
      repository.countProfilesWithRep(scope()),
      repository.countProfilesWithoutRep(scope()),
      repository.countProfiles(scope()),
    ]);

    expect(withRep + withoutRep).toBe(total);
  });

  it("opens a list as long as the number that opened it", async () => {
    // A card counting the assignment over a breakdown listing the whole scope
    // is how "1 atribuída" would open onto two clinics.
    expect(await drillDownTotal("assigned-clinics")).toBe(1);
    expect(await drillDownTotal("unassigned-clinics")).toBe(1);
  });

  it("puts every clinic in exactly one of the two lists", async () => {
    const [assigned, unassigned] = await Promise.all([
      repository.listScopedClinics({
        filter: scope(),
        predicate: metricPredicateForTest("assigned-clinics"),
        offset: 0,
        limit: 50,
      }),
      repository.listScopedClinics({
        filter: scope(),
        predicate: metricPredicateForTest("unassigned-clinics"),
        offset: 0,
        limit: 50,
      }),
    ]);

    const assignedIds = assigned.rows.map((row) => row.facilityId);
    const unassignedIds = unassigned.rows.map((row) => row.facilityId);

    expect(assignedIds).toHaveLength(1);
    expect(unassignedIds).toHaveLength(1);
    expect(assignedIds[0]).not.toBe(unassignedIds[0]);
  });
});
