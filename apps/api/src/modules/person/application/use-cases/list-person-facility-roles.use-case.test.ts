import { describe, expect, it } from "bun:test";
import { ListPersonFacilityRolesUseCase } from "./list-person-facility-roles.use-case";

describe("ListPersonFacilityRolesUseCase", () => {
  it("returns active catalog rows", async () => {
    const result = await new ListPersonFacilityRolesUseCase({
      roleCatalogRepository: {
        listActive: async () => [
          { code: "BUYER", name: "Comprador" },
          { code: "PRESCRIBER", name: "Prescritor" },
        ],
      },
    }).execute();

    expect(result).toEqual({
      data: [
        { code: "BUYER", name: "Comprador" },
        { code: "PRESCRIBER", name: "Prescritor" },
      ],
    });
  });
});
