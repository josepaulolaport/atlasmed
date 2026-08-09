import { describe, expect, it } from "bun:test";
import {
  assertTerritorialJurisdiction,
  isInTerritorialJurisdiction,
} from "./territory-scope-policy.service";
import { OperationNotAllowedError } from "../../../../shared/errors";

describe("territory-scope-policy", () => {
  it("isInTerritorialJurisdiction checks effectiveTerritoryIds", () => {
    expect(isInTerritorialJurisdiction({ effectiveTerritoryIds: [1, 2] }, 2)).toBe(true);
    expect(isInTerritorialJurisdiction({ effectiveTerritoryIds: [1, 2] }, 9)).toBe(false);
  });

  it("assertTerritorialJurisdiction allows global scope", () => {
    expect(() =>
      assertTerritorialJurisdiction(
        { isGlobal: true, effectiveTerritoryIds: [] },
        99,
        "update",
      ),
    ).not.toThrow();
  });

  it("assertTerritorialJurisdiction rejects out-of-scope territory", () => {
    expect(() =>
      assertTerritorialJurisdiction(
        { isGlobal: false, effectiveTerritoryIds: [1] },
        2,
        "update",
      ),
    ).toThrow(OperationNotAllowedError);
  });
});
