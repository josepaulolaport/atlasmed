import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityRepresentativeRepository } from "../interfaces/facility-representative.repository.interface";
import { serializeFacilityRepresentative } from "../mappers/facility-representative.mapper";

interface Dependencies {
  facilityRepresentativeRepository: FacilityRepresentativeRepository;
}

export class ListFacilityRepresentativesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    scope: ScopeContext;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const result =
      await this.deps.facilityRepresentativeRepository.findActiveByFacility({
        facilityId: input.facilityId,
        page: input.page,
        limit: input.limit,
        search: input.search,
      });

    return {
      data: result.items.map(serializeFacilityRepresentative),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }
}
