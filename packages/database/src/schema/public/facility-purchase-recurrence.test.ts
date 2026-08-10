import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig, type IndexedColumn } from "drizzle-orm/pg-core";
import {
  facilityVerticalProfiles,
  orders,
  purchaseFunnelStageEnum,
  purchaseIntervalSourceEnum,
  purchaseProfileEnum,
  type PurchaseFunnelStage,
  type PurchaseIntervalSource,
  type PurchaseProfile,
} from "../../index";

const columnByName = (table: Parameters<typeof getTableConfig>[0], name: string) =>
  getTableConfig(table).columns.find((column) => column.name === name);

describe("facility purchase recurrence schema", () => {
  test("exports recurrence enum values and value types", () => {
    expect(purchaseIntervalSourceEnum.enumValues).toEqual(["DEFAULT", "CALCULATED", "MANUAL"]);
    expect(purchaseProfileEnum.enumValues).toEqual([
      "WEEKLY",
      "BIWEEKLY",
      "MONTHLY",
      "BIMONTHLY",
      "QUARTERLY",
      "SEMIANNUAL",
      "ANNUAL",
      "CUSTOM",
    ]);
    expect(purchaseFunnelStageEnum.enumValues).toEqual([
      "NEVER_PURCHASED",
      "OUTSIDE_WINDOW",
      "PURCHASE_WINDOW",
      "CHURN",
      "INACTIVE",
    ]);

    const source: PurchaseIntervalSource = "MANUAL";
    const profile: PurchaseProfile = "CUSTOM";
    const stage: PurchaseFunnelStage = "PURCHASE_WINDOW";
    expect([source, profile, stage]).toEqual(["MANUAL", "CUSTOM", "PURCHASE_WINDOW"]);
  });

  test("defines exact recurrence column types, nullability, and defaults", () => {
    // Recurrence/funnel is owned by facility_vertical_profiles (per business
    // vertical). The facility-level rollup columns were dropped in migration
    // 0046; do not reintroduce assertions against `facilities` here.
    const expected = [
      ["observed_purchase_interval_days", "bigint", false, undefined],
      ["purchase_interval_days", "bigint", true, 30],
      ["purchase_interval_source", "purchase_interval_source", true, "DEFAULT"],
      ["manual_purchase_profile", "purchase_profile", false, undefined],
      ["manual_purchase_interval_days", "bigint", false, undefined],
      ["last_valid_purchase_date", "date", false, undefined],
      ["purchase_recurrence_sample_size", "smallint", true, 0],
      ["purchase_funnel_stage", "purchase_funnel_stage", true, "NEVER_PURCHASED"],
      ["next_purchase_funnel_transition_date", "date", false, undefined],
      ["purchase_recurrence_calculated_at", "timestamp with time zone", false, undefined],
    ] satisfies Array<[string, string, boolean, unknown]>;

    const missing = expected
      .map(([name]) => name)
      .filter((name) => columnByName(facilityVerticalProfiles, name) === undefined);
    expect(missing).toEqual([]);

    expect(
      expected.map(([name]) => {
        const column = columnByName(facilityVerticalProfiles, name);
        return [column?.name, column?.getSQLType(), column?.notNull, column?.default];
      }),
    ).toEqual(expected);
    expect(
      columnByName(facilityVerticalProfiles, "purchase_recurrence_calculated_at"),
    ).toMatchObject({
      withTimezone: true,
    });
  });

  test("the generated migration preserves exact recurrence checks and indexes", () => {
    const drizzleDir = new URL("../../../drizzle", import.meta.url).pathname;
    const migrationFiles = readdirSync(drizzleDir).filter(
      (f) => f.endsWith(".sql") && /_facility_vertical_profile_purchase_funnel\.sql$/.test(f),
    );
    if (migrationFiles.length !== 1) {
      throw new Error(
        `Expected exactly one facility_vertical_profile_purchase_funnel migration, found ${migrationFiles.length}: [${migrationFiles.join(", ")}]`,
      );
    }
    const migration = readFileSync(join(drizzleDir, migrationFiles[0]!), "utf8");

    const t = '"facility_vertical_profiles"';
    for (const sql of [
      `CHECK (${t}."observed_purchase_interval_days" is null or ${t}."observed_purchase_interval_days" between 1 and 3650)`,
      `CHECK (${t}."purchase_interval_days" between 1 and 3650)`,
      `CHECK (${t}."manual_purchase_interval_days" is null or ${t}."manual_purchase_interval_days" between 1 and 3650)`,
      `CHECK ((${t}."manual_purchase_profile" = 'CUSTOM' and ${t}."manual_purchase_interval_days" is not null)\n        or (${t}."manual_purchase_profile" is distinct from 'CUSTOM' and ${t}."manual_purchase_interval_days" is null))`,
      `CHECK (${t}."purchase_recurrence_sample_size" between 0 and 12)`,
      `CHECK ((${t}."purchase_interval_source" = 'MANUAL' and ${t}."manual_purchase_profile" is not null)\n        or (${t}."purchase_interval_source" <> 'MANUAL' and ${t}."manual_purchase_profile" is null))`,
      `CREATE INDEX "facility_vertical_profiles_vertical_funnel_stage_idx" ON ${t} USING btree ("vertical_id","purchase_funnel_stage");`,
      `CREATE INDEX "facility_vertical_profiles_next_funnel_transition_idx" ON ${t} USING btree ("next_purchase_funnel_transition_date","id") WHERE ${t}."is_active" = true and ${t}."next_purchase_funnel_transition_date" is not null;`,
      'CREATE INDEX "orders_valid_purchase_facility_vertical_ordered_at_idx" ON "orders" USING btree ("facility_id","vertical_id","ordered_at" DESC NULLS LAST) WHERE "orders"."status" in (\'APPROVED\', \'INVOICED\') and "orders"."type" in (\'SALE\', \'CONSIGNMENT\');',
    ]) {
      expect(migration).toContain(sql);
    }
  });

  test("keeps transition dates ordered by date then id for stable keyset pagination", () => {
    const transitionIndex = getTableConfig(facilityVerticalProfiles).indexes.find(
      (candidate) =>
        candidate.config.name === "facility_vertical_profiles_next_funnel_transition_idx",
    );

    expect(transitionIndex).toBeDefined();
    expect(
      transitionIndex?.config.columns.map((column) => {
        const indexedColumn = column as IndexedColumn;
        return [indexedColumn.name, indexedColumn.indexConfig.order];
      }),
    ).toEqual([
      ["next_purchase_funnel_transition_date", "asc"],
      ["id", "asc"],
    ]);
  });

  test("defines the valid purchase lookup in facility/date order with descending dates", () => {
    const purchaseIndex = getTableConfig(orders).indexes.find(
      (candidate) => candidate.config.name === "orders_valid_purchase_facility_ordered_at_idx",
    );

    expect(purchaseIndex).toBeDefined();
    expect(
      purchaseIndex?.config.columns.map((column) => {
        const indexedColumn = column as IndexedColumn;
        return [
          indexedColumn.name,
          indexedColumn.indexConfig.order,
          indexedColumn.indexConfig.nulls,
        ];
      }),
    ).toEqual([
      ["facility_id", "asc", "last"],
      ["ordered_at", "desc", "last"],
    ]);
  });
});
