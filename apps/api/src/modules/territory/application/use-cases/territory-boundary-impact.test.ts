import { describe, expect, it } from "bun:test";
import { ValidationError } from "../../../../shared/errors";
import { assertAcceptedImpactFacilityIds } from "./territory-boundary.use-cases";

describe("assertAcceptedImpactFacilityIds", () => {
  it("allows save when impact is empty and accepted omitted", () => {
    expect(() => assertAcceptedImpactFacilityIds([], undefined)).not.toThrow();
    expect(() => assertAcceptedImpactFacilityIds([], [])).not.toThrow();
  });

  it("rejects extra accepts when impact is empty", () => {
    expect(() => assertAcceptedImpactFacilityIds([], ["f1"])).toThrow(ValidationError);
  });

  it("requires accepts when impact is non-empty", () => {
    expect(() => assertAcceptedImpactFacilityIds(["f1"], undefined)).toThrow(
      ValidationError
    );
    expect(() => assertAcceptedImpactFacilityIds(["f1"], [])).toThrow(ValidationError);
  });

  it("requires exact set match", () => {
    expect(() => assertAcceptedImpactFacilityIds(["f1", "f2"], ["f1"])).toThrow(
      ValidationError
    );
    expect(() =>
      assertAcceptedImpactFacilityIds(["f1", "f2"], ["f1", "f2", "f3"])
    ).toThrow(ValidationError);
    expect(() =>
      assertAcceptedImpactFacilityIds(["f1", "f2"], ["f1", "f3"])
    ).toThrow(ValidationError);
    expect(() =>
      assertAcceptedImpactFacilityIds(["f1", "f2"], ["f2", "f1"])
    ).not.toThrow();
  });
});
