import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
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

  test("defines recurrence columns with safe defaults", () => {
    const expected = [
      "observed_purchase_interval_days",
      "purchase_interval_days",
      "purchase_interval_source",
      "manual_purchase_profile",
      "manual_purchase_interval_days",
      "last_valid_purchase_date",
      "purchase_recurrence_sample_size",
      "purchase_funnel_stage",
      "next_purchase_funnel_transition_date",
      "purchase_recurrence_calculated_at",
    ];

    expect(expected.map((name) => columnByName(facilities, name)?.name)).toEqual(expected);
    expect(columnByName(facilities, "purchase_interval_days")?.notNull).toBe(true);
    expect(columnByName(facilities, "purchase_interval_days")?.default).toBe(30);
    expect(columnByName(facilities, "purchase_interval_source")?.default).toBe("DEFAULT");
    expect(columnByName(facilities, "purchase_recurrence_sample_size")?.default).toBe(0);
    expect(columnByName(facilities, "purchase_funnel_stage")?.default).toBe("NEVER_PURCHASED");
  });

  test("defines recurrence checks and partial indexes", () => {
    const config = getTableConfig(facilities);
    expect(config.checks.map((constraint) => constraint.name)).toEqual(
      expect.arrayContaining([
        "facilities_observed_purchase_interval_days_check",
        "facilities_purchase_interval_days_check",
        "facilities_manual_purchase_interval_days_check",
        "facilities_manual_purchase_profile_days_check",
        "facilities_purchase_recurrence_sample_size_check",
        "facilities_purchase_interval_source_check",
      ]),
    );

    for (const name of [
      "facilities_active_purchase_funnel_stage_name_id_idx",
      "facilities_active_purchase_interval_days_name_id_idx",
      "facilities_active_manual_purchase_profile_name_id_idx",
      "facilities_active_next_purchase_funnel_transition_date_idx",
    ]) {
      expect(config.indexes.find((candidate) => candidate.config.name === name)?.config.where).toBeDefined();
    }
  });

  test("defines the valid purchase order lookup index", () => {
    const purchaseIndex = getTableConfig(orders).indexes.find(
      (candidate) => candidate.config.name === "orders_valid_purchase_facility_ordered_at_idx",
    );
    expect(purchaseIndex?.config.columns).toHaveLength(2);
    expect(purchaseIndex?.config.where).toBeDefined();
  });
});
