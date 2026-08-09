import { describe, expect, it } from "bun:test";
import { ValidationError } from "../../../../shared/errors";
import { resolveFacilityUnitCatalogIds } from "./facility-unit-catalog.utils";

describe("resolveFacilityUnitCatalogIds", () => {
  const findUnitSubtypeById = async (id: number) => {
    if (id === 20) return { id: 20, unitTypeId: 5 };
    return null;
  };

  it("returns type-only when subtype is absent", async () => {
    const result = await resolveFacilityUnitCatalogIds({
      unitTypeId: 5,
      unitSubtypeId: null,
      findUnitSubtypeById,
    });
    expect(result).toEqual({ unitTypeId: 5, unitSubtypeId: null });
  });

  it("derives unitTypeId from subtype when type omitted", async () => {
    const result = await resolveFacilityUnitCatalogIds({
      unitTypeId: null,
      unitSubtypeId: 20,
      findUnitSubtypeById,
    });
    expect(result).toEqual({ unitTypeId: 5, unitSubtypeId: 20 });
  });

  it("accepts matching unitTypeId + unitSubtypeId", async () => {
    const result = await resolveFacilityUnitCatalogIds({
      unitTypeId: 5,
      unitSubtypeId: 20,
      findUnitSubtypeById,
    });
    expect(result).toEqual({ unitTypeId: 5, unitSubtypeId: 20 });
  });

  it("rejects subtype that belongs to a different type", async () => {
    await expect(
      resolveFacilityUnitCatalogIds({
        unitTypeId: 7,
        unitSubtypeId: 20,
        findUnitSubtypeById,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects unknown unitSubtypeId", async () => {
    await expect(
      resolveFacilityUnitCatalogIds({
        unitTypeId: 5,
        unitSubtypeId: 999,
        findUnitSubtypeById,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
