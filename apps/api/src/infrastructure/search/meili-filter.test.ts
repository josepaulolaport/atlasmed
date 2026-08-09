import { describe, expect, it } from "bun:test";
import { Role } from "@atlasmed/access";
import {
  buildMeiliFilter,
  compactFacilityMeiliScopeFilter,
  compactPersonMeiliScopeFilter,
  eqFilter,
  geoRadiusFilter,
  gteFilter,
  inFilter,
  isNullFilter,
  lteFilter,
  orGroup,
} from "./meili-filter";

describe("Meilisearch filter builder", () => {
  it("escapes quoted and backslash string values", () => {
    expect(buildMeiliFilter([eqFilter("specialtyNormalized", "d'água \\ vascular")]))
      .toBe("specialtyNormalized = 'd\\'água \\\\ vascular'");
  });

  it("builds typed IN and geo-radius clauses without interpolating field names", () => {
    expect(buildMeiliFilter([
      inFilter("activeFacilityIds", [2, 1, 1]),
      geoRadiusFilter(-23.55, -46.63, 2500),
    ])).toBe("activeFacilityIds IN [1, 2] AND _geoRadius(-23.55, -46.63, 2500)");
  });

  it("builds allowlisted purchase filters with composite tokens and numeric bounds", () => {
    expect(buildMeiliFilter([
      inFilter("verticalFunnelStages", ["2:PURCHASE_WINDOW", "2:CHURN"]),
      inFilter("verticalPurchaseIntervalSources", ["2:MANUAL"]),
      inFilter("verticalManualPurchaseProfiles", ["2:MONTHLY"]),
      inFilter("purchaseFunnelStagesAny", ["PURCHASE_WINDOW", "CHURN"]),
      gteFilter("purchaseIntervalDaysMin", 15),
      lteFilter("purchaseIntervalDaysMin", 90),
    ])).toBe("verticalFunnelStages IN ['2:CHURN', '2:PURCHASE_WINDOW'] AND verticalPurchaseIntervalSources IN ['2:MANUAL'] AND verticalManualPurchaseProfiles IN ['2:MONTHLY'] AND purchaseFunnelStagesAny IN ['CHURN', 'PURCHASE_WINDOW'] AND purchaseIntervalDaysMin >= 15 AND purchaseIntervalDaysMin <= 90");
  });

  it("returns undefined when the bounded expression would be too large", () => {
    expect(buildMeiliFilter([inFilter("id", ["one", "two"])], 10)).toBeUndefined();
  });

  it("supports verticalIds array filter field", () => {
    expect(buildMeiliFilter([inFilter("verticalIds", [2, 1])])).toBe(
      "verticalIds IN [1, 2]"
    );
  });

  it("groups OR specialty filters", () => {
    expect(
      buildMeiliFilter([
        orGroup([
          eqFilter("specialtyNormalized", "cardiologia"),
          eqFilter("specialtyNormalized", "pediatria"),
        ]),
      ])
    ).toBe(
      "(specialtyNormalized = 'cardiologia' OR specialtyNormalized = 'pediatria')"
    );
  });

  it("builds compact facility scope by role (REP assignment / MANAGER zone)", () => {
    expect(
      compactFacilityMeiliScopeFilter({
        isGlobal: true,
        role: Role.ADMIN,
        userId: 1,
        facilityIds: [9],
      })
    ).toBeUndefined();

    expect(
      compactFacilityMeiliScopeFilter({
        isGlobal: false,
        role: Role.REP,
        userId: 42,
        oversightZoneIds: [7],
        facilityIds: Array.from({ length: 500 }, (_, i) => i + 1),
      })?.expression
    ).toBe("repUserIds = 42");

    expect(
      compactFacilityMeiliScopeFilter({
        isGlobal: false,
        role: Role.MANAGER,
        userId: 9,
        oversightZoneIds: [3, 1],
        facilityIds: Array.from({ length: 500 }, (_, i) => i + 1),
      })?.expression
    ).toBe("territoryIds IN [1, 3]");

    // Unassigned-in-zone: manager zone filter does not require facility ids.
    expect(
      compactFacilityMeiliScopeFilter({
        isGlobal: false,
        role: Role.MANAGER,
        userId: 9,
        oversightZoneIds: [5],
        facilityIds: [],
      })?.expression
    ).toBe("territoryIds IN [5]");

    expect(
      compactFacilityMeiliScopeFilter({
        isGlobal: false,
        role: Role.OPS,
        userId: 2,
        facilityIds: [4, 2],
      })?.expression
    ).toBe("id IN [2, 4]");
  });

  it("builds compact person scope (MANAGER territory; REP facility IN)", () => {
    expect(
      compactPersonMeiliScopeFilter({
        isGlobal: false,
        role: Role.MANAGER,
        oversightZoneIds: [8, 2],
        facilityIds: Array.from({ length: 500 }, (_, i) => i + 1),
      })?.expression
    ).toBe("activeTerritoryIds IN [2, 8]");

    expect(
      compactPersonMeiliScopeFilter({
        isGlobal: false,
        role: Role.REP,
        oversightZoneIds: [1],
        facilityIds: [3, 1],
      })?.expression
    ).toBe("activeFacilityIds IN [1, 3]");
  });
});
