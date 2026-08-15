import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import type { DashboardProfileFilter } from "../../application/dashboard-query";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";

/**
 * Sorting inside a metric breakdown.
 *
 * The list had no sort at all — the query ended in a hard-coded
 * `ORDER BY display_name, id` — while Explorar, one tap away, offers eight
 * orderings on the same clinics. The ordering is now Explorar's own
 * `buildFacilityListOrderBy`, so "Nome Z–A" and "Status de compras" cannot come
 * to mean two different things in two lists of the same rows.
 *
 * The details worth pinning are the ones a reimplementation gets wrong: that
 * `order` is honoured at all (the previous default branch returned ascending
 * whatever was asked), and that clinics with no purchase sort last rather than
 * first when the newest purchase is wanted.
 */
const dbUp = await isDatabaseReachable();

const MARK = "T-BREAKDOWN-SORT";
const STATE_IBGE = "9989";
const MUNICIPALITY_IBGE = "99890001";
const VERTICAL_CODE = "T_BSORT";
const repository = new DrizzleDashboardRepository();

interface Fixture {
  verticalId: number;
}

async function purge() {
  await db.execute(sql`
    delete from facility_vertical_profiles where facility_id in (
      select id from facilities where name like ${`${MARK}%`}
    );
  `);
  await db.execute(sql`delete from facilities where name like ${`${MARK}%`};`);
  await db.execute(
    sql`delete from business_verticals where code = ${VERTICAL_CODE};`,
  );
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

async function seedClinic(input: {
  suffix: string;
  cnes: string;
  verticalId: number;
  stage: string | null;
  lastPurchase: string | null;
  /** NOT NULL on the table; the shared expression's own default is 30. */
  intervalDays: number;
}): Promise<void> {
  const facilityId = await scalar(sql`
    insert into facilities (name, cnes_code, location, legal_document_type, state_id, municipality_id)
      select ${`${MARK} ${input.suffix}`}, ${input.cnes},
             ST_SetSRID(ST_MakePoint(-43.2, -22.9), 4326),
             'CNPJ'::facility_legal_document_type, m.state_id, m.id
        from municipalities m where m.ibge_id = ${MUNICIPALITY_IBGE}
      returning id;
  `);
  await db.execute(sql`
    insert into facility_vertical_profiles
      (facility_id, vertical_id, is_active, purchase_funnel_stage, last_valid_purchase_date, purchase_interval_days)
      values (
        ${facilityId}, ${input.verticalId}, true,
        ${input.stage === null ? null : sql.raw(`'${input.stage}'::purchase_funnel_stage`)},
        ${input.lastPurchase},
        ${input.intervalDays}
      );
  `);
}

async function seed(): Promise<Fixture> {
  const stateId = await scalar(sql`
    insert into states (name, ibge_id, abbreviation)
      values (${`${MARK} UF`}, ${STATE_IBGE}, 'ZH') returning id;
  `);
  await db.execute(sql`
    insert into municipalities (state_id, name, ibge_id)
      values (${stateId}, ${`${MARK} City`}, ${MUNICIPALITY_IBGE});
  `);
  const verticalId = await scalar(sql`
    insert into business_verticals (code, name)
      values (${VERTICAL_CODE}, 'T-BSORT Vertical') returning id;
  `);

  await seedClinic({
    suffix: "Alfa",
    cnes: "T9989001",
    verticalId,
    stage: "PURCHASE_WINDOW",
    lastPurchase: "2026-07-01",
    intervalDays: 30,
  });
  await seedClinic({
    suffix: "Bravo",
    cnes: "T9989002",
    verticalId,
    stage: "CHURN",
    lastPurchase: "2026-01-15",
    intervalDays: 90,
  });
  await seedClinic({
    suffix: "Charlie",
    cnes: "T9989003",
    verticalId,
    stage: "NEVER_PURCHASED",
    // The one that has never bought — the row that decides where nulls land.
    lastPurchase: null,
    intervalDays: 60,
  });

  return { verticalId };
}

describe.if(dbUp)("sorting a metric breakdown", () => {
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

  const names = async (
    sort?: Parameters<typeof repository.listScopedClinics>[0]["sort"],
    order?: "asc" | "desc",
  ) => {
    const { rows } = await repository.listScopedClinics({
      filter: scope(),
      sort,
      order,
      offset: 0,
      limit: 50,
    });
    return rows.map((row) => row.name.replace(`${MARK} `, ""));
  };

  it("defaults to name ascending, as it always did", async () => {
    expect(await names()).toEqual(["Alfa", "Bravo", "Charlie"]);
  });

  it("honours a descending name sort", async () => {
    // The old default branch returned ascending whatever was asked, so
    // "Nome Z–A" could not have worked through it.
    expect(await names("name", "desc")).toEqual(["Charlie", "Bravo", "Alfa"]);
  });

  it("orders by funnel stage, both ways", async () => {
    const ascending = await names("purchaseFunnelStage", "asc");
    const descending = await names("purchaseFunnelStage", "desc");

    expect(ascending).toEqual([...descending].reverse());
    // Whatever the rank is, the two directions must disagree — a sort that
    // returned the same order twice would look like it worked.
    expect(ascending).not.toEqual(descending);
  });

  it("puts clinics that never bought last when the newest is wanted", async () => {
    // Nulls sort first in Postgres for `desc`, so the clinic with no purchase
    // at all would head a list titled "most recent purchase".
    expect(await names("lastPurchaseDate", "desc")).toEqual([
      "Alfa",
      "Bravo",
      "Charlie",
    ]);
  });

  it("keeps them last when the oldest is wanted too", async () => {
    expect(await names("lastPurchaseDate", "asc")).toEqual([
      "Bravo",
      "Alfa",
      "Charlie",
    ]);
  });

  it("orders by purchase interval", async () => {
    // 30 · 60 · 90.
    expect(await names("purchaseIntervalDays", "asc")).toEqual([
      "Alfa",
      "Charlie",
      "Bravo",
    ]);
    expect(await names("purchaseIntervalDays", "desc")).toEqual([
      "Bravo",
      "Charlie",
      "Alfa",
    ]);
  });

  it("returns every clinic whatever the ordering", async () => {
    // A sort is not a filter. An ordering expression that silently dropped
    // nulls would shorten the list and disagree with the card that opened it.
    for (const sort of [
      "name",
      "purchaseFunnelStage",
      "purchaseIntervalDays",
      "lastPurchaseDate",
    ] as const) {
      expect(await names(sort, "asc")).toHaveLength(3);
      expect(await names(sort, "desc")).toHaveLength(3);
    }
  });
});
