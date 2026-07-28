import { describe, expect, it } from "bun:test";
import { applyVerticalProfileContext } from "./facility-vertical-scope.utils";

const ortho = {
  verticalId: "v-orto",
  verticalCode: "ORTOPEDIA",
  verticalName: "Ortopedia",
  isActive: true,
  commercialStatus: "UNREGISTERED" as const,
  purchaseStatus: null,
  territoryId: null,
};

const derm = {
  verticalId: "v-derm",
  verticalCode: "DERMATOLOGIA",
  verticalName: "Dermatologia",
  isActive: true,
  commercialStatus: "UNREGISTERED" as const,
  purchaseStatus: null,
  territoryId: null,
};

describe("applyVerticalProfileContext", () => {
  it("exposes shared commercialStatus when multi-vertical profiles agree", () => {
    const result = applyVerticalProfileContext(
      {
        commercialStatus: null,
        purchaseStatus: null,
        verticalProfiles: [ortho, derm],
      },
      [ortho.verticalId, derm.verticalId],
    );

    expect(result.commercialStatus).toBe("UNREGISTERED");
    expect(result.verticalProfiles).toHaveLength(2);
  });

  it("omits commercialStatus when multi-vertical profiles disagree", () => {
    const result = applyVerticalProfileContext(
      {
        commercialStatus: null,
        purchaseStatus: null,
        verticalProfiles: [
          ortho,
          { ...derm, commercialStatus: "REGISTERED" },
        ],
      },
      [ortho.verticalId, derm.verticalId],
    );

    expect(result.commercialStatus).toBeUndefined();
    expect(result.verticalProfiles).toHaveLength(2);
  });
});
