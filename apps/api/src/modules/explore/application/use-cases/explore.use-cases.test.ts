import { describe, expect, it } from "bun:test";
import type {
  FacilityDto,
  PaginatedResult,
  ProfessionalDto,
} from "../types/explore.types";
import { ExploreUseCases } from "./explore.use-cases";
import type { McpTestRepository } from "../../infrastructure/repositories/mcp-test.repository";

function createMockRepository(
  overrides: Partial<McpTestRepository> = {},
): McpTestRepository {
  return {
    listFacilities: async () => ({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    }),
    getFacility: async () => null,
    listProfessionals: async () => ({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    }),
    getProfessional: async () => null,
    ...overrides,
  } as McpTestRepository;
}

describe("ExploreUseCases", () => {
  it("defaults pagination for facility list", async () => {
    let captured: { page: number; limit: number; search?: string } | undefined;

    const useCases = new ExploreUseCases(
      createMockRepository({
        listFacilities: async (params) => {
          captured = params;
          return {
            data: [{ facilityId: "f1" } as FacilityDto],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          } satisfies PaginatedResult<FacilityDto>;
        },
      }),
    );

    const result = await useCases.listFacilities({ search: "clinica" });

    expect(captured).toEqual({ page: 1, limit: 20, search: "clinica" });
    expect(result.data).toHaveLength(1);
  });

  it("caps facility list limit at 50", async () => {
    let capturedLimit = 0;

    const useCases = new ExploreUseCases(
      createMockRepository({
        listFacilities: async (params) => {
          capturedLimit = params.limit;
          return {
            data: [],
            pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
          };
        },
      }),
    );

    await useCases.listFacilities({ limit: 999 });

    expect(capturedLimit).toBe(50);
  });

  it("delegates getProfessional to repository", async () => {
    const useCases = new ExploreUseCases(
      createMockRepository({
        getProfessional: async (id) =>
          ({
            professionalId: id,
            fullName: "Dr. Test",
          }) as ProfessionalDto,
      }),
    );

    const result = await useCases.getProfessional("prof-123");

    expect(result?.professionalId).toBe("prof-123");
    expect(result?.fullName).toBe("Dr. Test");
  });
});
