import { describe, expect, it } from "bun:test";
import { TerritoryCodeGenerator } from "./territory-code-generator.service";

describe("TerritoryCodeGenerator", () => {
  const generator = new TerritoryCodeGenerator();

  it("generates root code", () => {
    expect(generator.generateCode({ nodeType: "root", name: "Brazil" })).toBe("BR");
  });

  it("generates region code", () => {
    expect(
      generator.generateCode({ nodeType: "region", name: "Sudeste", regionSlug: "SE" })
    ).toBe("BR-SE");
  });

  it("generates patch sequence code", () => {
    expect(
      generator.generateCode({
        nodeType: "patch",
        name: "Patch 1",
        parentCode: "BR-SE-SP",
        patchSequence: 2,
      })
    ).toBe("BR-SE-SP-02");
  });
});
