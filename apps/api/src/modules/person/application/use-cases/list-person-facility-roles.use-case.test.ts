import { describe, expect, it } from "bun:test";
import { ListPersonFacilityRolesUseCase } from "./list-person-facility-roles.use-case";

describe("ListPersonFacilityRolesUseCase", () => {
  it("returns active catalog rows", async () => {
    const result = await new ListPersonFacilityRolesUseCase({
      roleCatalogRepository: {
        listActive: async () => [
          { id: 2, name: "Comprador", isActive: true },
          { id: 1, name: "Prescritor", isActive: true },
        ],
      },
    }).execute();

    expect(result).toEqual({
      data: [
        { id: 2, name: "Comprador", isActive: true },
        { id: 1, name: "Prescritor", isActive: true },
      ],
    });
  });
});
