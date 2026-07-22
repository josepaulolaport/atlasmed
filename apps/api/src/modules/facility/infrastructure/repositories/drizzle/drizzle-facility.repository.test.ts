import { describe, expect, it } from "bun:test";

import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildFacilityListConditions,
  buildFacilityListOrderBy,
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
      purchaseProfile: "AUTOMATIC",
      purchaseFunnelStages: ["PURCHASE_WINDOW", "CHURN"],
      purchaseIntervalMinDays: 15,
      purchaseIntervalMaxDays: 90,
    }));

    expect(sql).toContain('"facilities"."deactivated_at" is null');
    expect(sql).toContain('"facilities"."id" in');
    expect(sql).toContain('"facilities"."name" ilike');
    expect(sql).toContain('"facilities"."manual_purchase_profile" is null');
    expect(sql).toContain('"facilities"."purchase_funnel_stage" in');
    expect(sql).toContain('"facilities"."purchase_interval_days" >=');
    expect(sql).toContain('"facilities"."purchase_interval_days" <=');
    expect(params).toEqual(expect.arrayContaining([
      "facility-1",
      "facility-2",
      "%Central%",
      "PURCHASE_WINDOW",
      "CHURN",
      15,
      90,
    ]));
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
    expect(lastAsc[0]).toContain('"facilities"."last_valid_purchase_date" asc nulls last');
    expect(lastDesc[0]).toContain('"facilities"."last_valid_purchase_date" desc nulls last');
    expect(lastAsc.slice(1)).toEqual(lastDesc.slice(1));
    expect(lastAsc[1]).toContain('"facilities"."name" asc');
    expect(lastAsc[2]).toContain('"facilities"."id" asc');
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
