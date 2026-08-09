import { describe, expect, it } from "bun:test";
import { applyVerticalProfileContext } from "./facility-vertical-scope.utils";

const ortho = {
  verticalId: 1,
  verticalCode: "ORTOPEDIA",
  verticalName: "Ortopedia",
  isActive: true,
  commercialStatus: "REGISTERED" as const,
  purchaseStatus: "REGULAR_BUYER" as const,
  territoryId: null,
};

const derm = {
  verticalId: 2,
  verticalCode: "DERMATOLOGIA",
  verticalName: "Dermatologia",
  isActive: true,
  commercialStatus: "UNREGISTERED" as const,
  purchaseStatus: null,
  territoryId: null,
};

describe("applyVerticalProfileContext", () => {
  it("exposes all profiles in scope without projecting commercial fields", () => {
    const result = applyVerticalProfileContext(
      { verticalProfiles: [ortho, derm] },
      [ortho.verticalId, derm.verticalId],
    );

    expect(result.verticalProfiles).toHaveLength(2);
    expect(result.hasProfileContext).toBe(true);
    expect("commercialStatus" in result).toBe(false);
    expect("purchaseStatus" in result).toBe(false);
    expect("purchaseRecurrence" in result).toBe(false);
  });

  it("can expose assigned profiles while filter verticalIds are narrower", () => {
    const result = applyVerticalProfileContext(
      { verticalProfiles: [ortho, derm] },
      [ortho.verticalId],
      { exposeProfileVerticalIds: [ortho.verticalId, derm.verticalId] },
    );

    expect(result.verticalProfiles).toHaveLength(2);
    expect(result.verticalProfiles?.map((p) => p.verticalId)).toEqual([1, 2]);
  });

  it("returns empty exposure when no profiles match expose ids", () => {
    const result = applyVerticalProfileContext(
      { verticalProfiles: [ortho] },
      [derm.verticalId],
    );

    expect(result.verticalProfiles).toBeUndefined();
    expect(result.hasProfileContext).toBe(true);
  });
});
