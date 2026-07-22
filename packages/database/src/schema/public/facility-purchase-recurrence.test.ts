import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getTableConfig, type IndexedColumn } from "drizzle-orm/pg-core";
import {
  facilities,
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
    const expected = [
      ["observed_purchase_interval_days", "integer", false, undefined],
      ["purchase_interval_days", "integer", true, 30],
      ["purchase_interval_source", "purchase_interval_source", true, "DEFAULT"],
      ["manual_purchase_profile", "purchase_profile", false, undefined],
      ["manual_purchase_interval_days", "integer", false, undefined],
      ["last_valid_purchase_date", "date", false, undefined],
      ["purchase_recurrence_sample_size", "smallint", true, 0],
      ["purchase_funnel_stage", "purchase_funnel_stage", true, "NEVER_PURCHASED"],
      ["next_purchase_funnel_transition_date", "date", false, undefined],
      ["purchase_recurrence_calculated_at", "timestamp with time zone", false, undefined],
    ] satisfies Array<[string, string, boolean, unknown]>;

    expect(
      expected.map(([name]) => {
        const column = columnByName(facilities, name);
        return [column?.name, column?.getSQLType(), column?.notNull, column?.default];
      }),
    ).toEqual(expected);
    expect(columnByName(facilities, "purchase_recurrence_calculated_at")).toMatchObject({
      withTimezone: true,
    });
  });

  test("the generated migration preserves exact recurrence checks and indexes", () => {
    const migration = readFileSync(
      new URL("../../../drizzle/0006_facility_purchase_recurrence.sql", import.meta.url),
      "utf8",
    );

    for (const sql of [
      'CHECK ("facilities"."observed_purchase_interval_days" is null or "facilities"."observed_purchase_interval_days" between 1 and 3650)',
      'CHECK ("facilities"."purchase_interval_days" between 1 and 3650)',
      'CHECK ("facilities"."manual_purchase_interval_days" is null or "facilities"."manual_purchase_interval_days" between 1 and 3650)',
      'CHECK (("facilities"."manual_purchase_profile" = \'CUSTOM\' and "facilities"."manual_purchase_interval_days" is not null)\n        or ("facilities"."manual_purchase_profile" is distinct from \'CUSTOM\' and "facilities"."manual_purchase_interval_days" is null))',
      'CHECK ("facilities"."purchase_recurrence_sample_size" between 0 and 12)',
      'CHECK (("facilities"."purchase_interval_source" = \'MANUAL\' and "facilities"."manual_purchase_profile" is not null)\n        or ("facilities"."purchase_interval_source" <> \'MANUAL\' and "facilities"."manual_purchase_profile" is null))',
      'CREATE INDEX "facilities_active_purchase_funnel_stage_name_id_idx" ON "facilities" USING btree ("purchase_funnel_stage","name","id") WHERE "facilities"."deactivated_at" is null;',
      'CREATE INDEX "facilities_active_purchase_interval_days_name_id_idx" ON "facilities" USING btree ("purchase_interval_days","name","id") WHERE "facilities"."deactivated_at" is null;',
      'CREATE INDEX "facilities_active_manual_purchase_profile_name_id_idx" ON "facilities" USING btree ("manual_purchase_profile","name","id") WHERE "facilities"."deactivated_at" is null;',
      'CREATE INDEX "facilities_active_next_purchase_funnel_transition_date_idx" ON "facilities" USING btree ("next_purchase_funnel_transition_date","id") WHERE "facilities"."deactivated_at" is null and "facilities"."next_purchase_funnel_transition_date" is not null;',
      'CREATE INDEX "orders_valid_purchase_facility_ordered_at_idx" ON "orders" USING btree ("facility_id","ordered_at" DESC NULLS LAST) WHERE "orders"."status" in (\'APPROVED\', \'INVOICED\') and "orders"."type" in (\'SALE\', \'CONSIGNMENT\');',
    ]) {
      expect(migration).toContain(sql);
    }
  });

  test("keeps transition dates ordered by date then id for stable keyset pagination", () => {
    const transitionIndex = getTableConfig(facilities).indexes.find(
      (candidate) =>
        candidate.config.name === "facilities_active_next_purchase_funnel_transition_date_idx",
    );

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
