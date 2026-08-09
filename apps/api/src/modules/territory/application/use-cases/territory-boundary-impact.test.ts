import { describe, expect, it } from "bun:test";
import { ValidationError } from "../../../../shared/errors";
import { assertAcceptedImpactFacilityIds } from "./territory-boundary.use-cases";

describe("assertAcceptedImpactFacilityIds", () => {
  it("allows save when impact is empty and accepted omitted", () => {
    expect(() => assertAcceptedImpactFacilityIds([], undefined)).not.toThrow();
    expect(() => assertAcceptedImpactFacilityIds([], [])).not.toThrow();
  });

  it("rejects extra accepts when impact is empty", () => {
    expect(() => assertAcceptedImpactFacilityIds([], [101])).toThrow(ValidationError);
  });

  it("requires accepts when impact is non-empty", () => {
    expect(() => assertAcceptedImpactFacilityIds([101], undefined)).toThrow(
      ValidationError
    );
    expect(() => assertAcceptedImpactFacilityIds([101], [])).toThrow(ValidationError);
  });

  it("requires exact set match", () => {
    expect(() => assertAcceptedImpactFacilityIds([101, 102], [101])).toThrow(
      ValidationError
    );
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [101, 102, 103])
    ).toThrow(ValidationError);
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [101, 103])
    ).toThrow(ValidationError);
    expect(() =>
      assertAcceptedImpactFacilityIds([101, 102], [102, 101])
    ).not.toThrow();
  });
});
