import type { McpTestRepository } from "../../infrastructure/repositories/mcp-test.repository";

interface ListInput {
  page?: number;
  limit?: number;
  search?: string;
  stateCodes?: string[];
  cities?: string[];
  facilityTypes?: string[];
}

export class ExploreUseCases {
  constructor(private readonly repository: McpTestRepository) {}

  listFacilities(input: ListInput) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(50, Math.max(1, input.limit ?? 20));
    return this.repository.listFacilities({
      page,
      limit,
      search: input.search,
      stateCodes: input.stateCodes,
      cities: input.cities,
      facilityTypes: input.facilityTypes,
    });
  }

  listFacilityFilterOptions() {
    return this.repository.listFacilityFilterOptions();
  }

  listFacilityCities(input: { search?: string; stateCodes?: string[]; limit?: number }) {
    return this.repository.listFacilityCities(input);
  }

  getFacility(facilityId: string) {
    return this.repository.getFacility(facilityId);
  }

  listProfessionals(input: ListInput) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(50, Math.max(1, input.limit ?? 20));
    return this.repository.listProfessionals({ page, limit, search: input.search });
  }

  getProfessional(professionalId: string) {
    return this.repository.getProfessional(professionalId);
  }
}
