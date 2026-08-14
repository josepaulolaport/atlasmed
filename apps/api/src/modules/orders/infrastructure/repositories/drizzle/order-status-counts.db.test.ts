import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleOrderRepository } from "./drizzle-order.repository";

/**
 * The status breakdown behind the Pedidos summary strip, and the audit actors
 * on the detail payload.
 *
 * The strip used to count the loaded page, so on a data set of 1131 orders it
 * reported whatever the first 20 happened to contain and the number moved as
 * the rep scrolled. Both facts worth pinning here need real rows: that the
 * breakdown spans the whole scoped set rather than the page, and that it
 * ignores the caller's own status filter — a query that returned its own
 * filter's count would look right in every single-status test.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-ORDER-COUNTS";
const STATE_IBGE = "9995";
const MUNICIPALITY_IBGE = "99950001";
const VERTICAL_CODE = "T_ORD_CNT";
const repository = new DrizzleOrderRepository();

interface Fixture {
  facilityId: number;
  verticalId: number;
  profileId: number;
  actorId: number;
  rejectedOrderId: number;
}

async function purge() {
  await db.execute(sql`
    delete from order_items where order_id in (
      select o.id from orders o
        join facility_vertical_profiles p on p.id = o.facility_vertical_profile_id
        join facilities f on f.id = p.facility_id
       where f.name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`
    delete from orders where facility_vertical_profile_id in (
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
  await db.execute(sql`delete from business_verticals where code = ${VERTICAL_CODE};`);
  await db.execute(sql`delete from users where email = ${`${MARK}@example.test`};`);
  await db.execute(sql`
    delete from municipalities
     where ibge_id = ${MUNICIPALITY_IBGE}
        or state_id in (select id from states where ibge_id = ${STATE_IBGE});
  `);
  await db.execute(sql`delete from states where ibge_id = ${STATE_IBGE};`);
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const [row] = (await db.execute(query)) as unknown as { id: number | string }[];
  if (!row) throw new Error("fixture row was not created");
  return Number(row.id);
}

async function seed(): Promise<Fixture> {
  await db.execute(sql`
    insert into states (name, ibge_id, abbreviation)
      values ('T-ORD UF', ${STATE_IBGE}, 'ZF') on conflict do nothing;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      select s.id, 'T-ORD City', ${MUNICIPALITY_IBGE} from states s
       where s.ibge_id = ${STATE_IBGE} on conflict do nothing;
  `);

  const verticalId = await scalar(sql`
    insert into business_verticals (code, name) values (${VERTICAL_CODE}, 'T-ORD Vertical')
      returning id;
  `);
  // cnes_code is NOT NULL since the CNES registry cutover, and unique among
  // live facilities — hence a code no real establishment can hold.
  const facilityId = await scalar(sql`
    insert into facilities (name, cnes_code, location, legal_document_type, state_id, municipality_id)
      select ${`${MARK} CLINICA`}, ${"T9995001"},
             ST_SetSRID(ST_MakePoint(-43.2, -22.9), 4326),
             'CNPJ'::facility_legal_document_type, m.state_id, m.id
        from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE}
      returning id;
  `);
  const profileId = await scalar(sql`
    insert into facility_vertical_profiles (facility_id, vertical_id, is_active)
      values (${facilityId}, ${verticalId}, true) returning id;
  `);
  const actorId = await scalar(sql`
    insert into users (email, username, password_hash, first_name, last_name, role_id)
      select ${`${MARK}@example.test`}, ${`${MARK}-user`}, 'x', 'Marina', 'Duarte', r.id
        from roles r order by r.id limit 1
      returning id;
  `);

  // Deliberately lopsided: more INVOICED than fit on a one-row page, so a
  // breakdown computed from the page cannot accidentally match the true one.
  const makeOrder = async (status: string, rejectedBy: number | null) =>
    scalar(sql`
      insert into orders (facility_vertical_profile_id, status, type, ordered_at, rejected_by_id, rejection_reason)
        values (${profileId}, ${sql.raw(`'${status}'::order_status`)}, 'SALE'::order_type,
                now(), ${rejectedBy}, ${rejectedBy === null ? null : "Fora de linha"})
        returning id;
    `);

  await makeOrder("INVOICED", null);
  await makeOrder("INVOICED", null);
  await makeOrder("INVOICED", null);
  await makeOrder("NO_BILLING", null);
  await makeOrder("PENDING", null);
  const rejectedOrderId = await makeOrder("REJECTED", actorId);

  return { facilityId, verticalId, profileId, actorId, rejectedOrderId };
}

describe.if(dbUp)("order status counts and audit actors", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    await purge();
    fixture = await seed();
  });

  afterAll(purge);

  const listPage = (statuses?: string[]) =>
    repository.findAll({
      page: 1,
      limit: 1,
      facilityId: fixture.facilityId,
      verticalIds: [fixture.verticalId],
      statuses: statuses as never,
      scope: { isGlobal: true },
    });

  it("counts every status across the whole set, not the loaded page", async () => {
    // limit is 1, so a page-local count would report a single order.
    const { orders, statusCounts } = await listPage();

    expect(orders).toHaveLength(1);
    expect(statusCounts.INVOICED).toBe(3);
    expect(statusCounts.NO_BILLING).toBe(1);
    expect(statusCounts.PENDING).toBe(1);
    expect(statusCounts.REJECTED).toBe(1);
  });

  it("keeps the breakdown steady while a status filter is applied", async () => {
    // The whole point of the strip: the rep taps "Faturado" and the other
    // tallies must not collapse to zero, or the counts become a readout of
    // whichever tab is open.
    const { statusCounts } = await listPage(["INVOICED"]);

    expect(statusCounts.INVOICED).toBe(3);
    expect(statusCounts.NO_BILLING).toBe(1);
    expect(statusCounts.PENDING).toBe(1);
  });

  it("reports a status nobody has as zero rather than omitting it", async () => {
    // A missing key and a real zero look the same to a client that has to
    // decide what absent means.
    const { statusCounts } = await listPage();

    expect(statusCounts.DRAFT).toBe(0);
    expect(statusCounts.APPROVED).toBe(0);
  });

  it("resolves the rejecting user to a name, not a bare id", async () => {
    // "Rejeitado por 7" names nobody.
    const detail = await repository.findById(fixture.rejectedOrderId);

    expect(detail?.rejectedById).toBe(fixture.actorId);
    expect(detail?.rejectedBy).toEqual({
      id: fixture.actorId,
      name: "Marina Duarte",
    });
    expect(detail?.rejectionReason).toBe("Fora de linha");
  });

  it("leaves an unset audit actor null", async () => {
    const detail = await repository.findById(fixture.rejectedOrderId);

    expect(detail?.finalizedBy).toBeNull();
    expect(detail?.noBillingBy).toBeNull();
    expect(detail?.expenseAuthorizedBy).toBeNull();
  });
});
