import { describe, expect, it } from "bun:test";

import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildFacilityListConditions,
  buildFacilityListOrderBy,
  buildMapViewportCondition,
} from "./drizzle-facility.repository";

const dialect = new PgDialect();

function sqlShape(query: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]);
}

describe("facility list SQL", () => {
  it("applies scope, textual search, automatic profile, stage, and interval filters to the shared where clause", () => {
    const { sql, params } = sqlShape(buildFacilityListConditions({
      scope: { isGlobal: false, facilityIds: ["facility-1", "facility-2"] },
      search: "Central",
      productIds: ["product-1"],
      purchaseProfile: "AUTOMATIC",
      purchaseFunnelStages: ["PURCHASE_WINDOW", "CHURN"],
      purchaseIntervalMinDays: 15,
      purchaseIntervalMaxDays: 90,
    }));

    expect(sql).toContain('"facilities"."deactivated_at" is null');
    expect(sql).toContain('"facilities"."id" in');
    for (const column of [
      "name",
      "legal_name",
      "trade_name",
      "cnpj",
      "cpf",
      "cnes_code",
      "city",
      "state",
    ]) {
      expect(sql).toContain(`"facilities"."${column}" ilike`);
    }
    expect(sql).toContain(" or ");
    expect(sql).toContain('"orders" inner join "order_items"');
    expect(sql).toContain('"order_items"."product_id" in');
    expect(sql).toContain('"facilities"."manual_purchase_profile" is null');
    expect(sql).toContain('"facilities"."purchase_funnel_stage" in');
    expect(sql).toContain('"facilities"."purchase_interval_days" >=');
    expect(sql).toContain('"facilities"."purchase_interval_days" <=');
    expect(params).toEqual(expect.arrayContaining([
      "facility-1",
      "facility-2",
      "%Central%",
      "product-1",
      "PURCHASE_WINDOW",
      "CHURN",
      15,
      90,
    ]));
  });

  it("requires every selected serviceCodes (AND), not any-of (OR)", () => {
    const { sql, params } = sqlShape(buildFacilityListConditions({
      scope: { isGlobal: true },
      serviceCodes: ["AM-ORTOPEDIA", "AM-DERMATOLOGIA", "AM-ORTOPEDIA"],
    }));

    expect(sql).toContain('"facility_services"."service_code" in');
    expect(sql).toContain("group by");
    expect(sql).toContain("count(distinct");
    expect(sql).toMatch(/=\s*\$?\d+|=\s*2/);
    // Deduped codes → HAVING count = 2
    expect(params).toEqual(
      expect.arrayContaining(["AM-ORTOPEDIA", "AM-DERMATOLOGIA", 2]),
    );
  });

  it("maps Desempenho purchaseBucket to purchase_funnel_stage (not purchase_status)", () => {
    const active = sqlShape(buildFacilityListConditions({
      scope: { isGlobal: true },
      purchaseBucket: "active",
    }));
    expect(active.sql).toContain('"facilities"."purchase_funnel_stage" in');
    expect(active.sql).not.toContain("purchase_status");
    expect(active.params).toContain("PURCHASE_WINDOW");
    expect(active.params).not.toContain("OUTSIDE_WINDOW");

    const inactive = sqlShape(buildFacilityListConditions({
      scope: { isGlobal: true },
      purchaseBucket: "inactive",
    }));
    expect(inactive.params).toEqual(
      expect.arrayContaining(["OUTSIDE_WINDOW", "CHURN"]),
    );

    const neverBought = sqlShape(buildFacilityListConditions({
      scope: { isGlobal: true },
      purchaseBucket: "neverBought",
    }));
    expect(neverBought.sql).toContain("is null");
    expect(neverBought.params).toEqual(
      expect.arrayContaining(["NEVER_PURCHASED", "INACTIVE"]),
    );
  });

  it("uses business stage order followed by stable name and id", () => {
    const orderBy = buildFacilityListOrderBy({ sort: "purchaseFunnelStage", order: "desc" });
    const shapes = orderBy.map((expression) => sqlShape(expression).sql);

    expect(shapes[0]).toContain("when 'NEVER_PURCHASED' then 0");
    expect(shapes[0]).toContain("when 'PURCHASE_WINDOW' then 2");
    expect(shapes[0]).toEndWith(" desc");
    expect(shapes[1]).toContain('"facilities"."name" asc');
    expect(shapes[2]).toContain('"facilities"."id" asc');
  });

  it("orders interval and last purchase deterministically with null purchases last in both directions", () => {
    const interval = buildFacilityListOrderBy({ sort: "purchaseIntervalDays", order: "asc" })
      .map((expression) => sqlShape(expression).sql);
    const lastAsc = buildFacilityListOrderBy({ sort: "lastPurchaseDate", order: "asc" })
      .map((expression) => sqlShape(expression).sql);
    const lastDesc = buildFacilityListOrderBy({ sort: "lastPurchaseDate", order: "desc" })
      .map((expression) => sqlShape(expression).sql);

    expect(interval).toEqual([
      expect.stringContaining('"facilities"."purchase_interval_days" asc'),
      expect.stringContaining('"facilities"."name" asc'),
      expect.stringContaining('"facilities"."id" asc'),
    ]);
    // Nulls last via leading `is null` bool sort (not SQL NULLS LAST).
    expect(lastAsc[0]).toContain('"facilities"."last_valid_purchase_date" is null');
    expect(lastDesc[0]).toContain('"facilities"."last_valid_purchase_date" is null');
    expect(lastAsc[1]).toContain('"facilities"."last_valid_purchase_date" asc');
    expect(lastDesc[1]).toContain('"facilities"."last_valid_purchase_date" desc');
    expect(lastAsc.slice(2)).toEqual(lastDesc.slice(2));
    expect(lastAsc[2]).toContain('"facilities"."name" asc');
    expect(lastAsc[3]).toContain('"facilities"."id" asc');
  });
});

describe("facility map points SQL", () => {
  it("limits map points to the visible radius with ST_DWithin", () => {
    const { sql, params } = sqlShape(buildMapViewportCondition({
      latitude: -23.55,
      longitude: -46.63,
      radiusKm: 8,
    }));

    const normalizedSql = sql.toLowerCase();
    expect(normalizedSql).toContain("st_dwithin");
    expect(normalizedSql).toContain("st_setsrid");
    expect(normalizedSql).toContain("st_makepoint");
    expect(sql).toContain("::geography");
    expect(params).toEqual(expect.arrayContaining([-46.63, -23.55, 8000]));
  });
});

describe("Facility source upsert manual edit protection", () => {
  it("skips overwriting display fields when manuallyEditedAt is set", () => {
    const existing = {
      manuallyEditedAt: new Date("2026-01-01"),
      sourceContentHash: "hash-1",
    };

    const input = {
      name: "Source Name",
      address: "Source Address",
      lat: -23.5,
      lng: -46.6,
      sourceContentHash: "hash-2",
      sourceLastSeenAt: new Date(),
    };

    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
    };

    if (!existing.manuallyEditedAt) {
      updateData.name = input.name;
      updateData.address = input.address;
      if (input.lat !== undefined) updateData.lat = input.lat;
      if (input.lng !== undefined) updateData.lng = input.lng;
    }

    expect(updateData.name).toBeUndefined();
    expect(updateData.address).toBeUndefined();
    expect(updateData.lat).toBeUndefined();
    expect(updateData.lng).toBeUndefined();
    expect(updateData.sourceContentHash).toBe("hash-2");
  });
});
