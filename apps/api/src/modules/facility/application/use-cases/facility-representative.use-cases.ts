import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type {
  FacilityRepresentativeContactType,
  FacilityRepresentativeRepository,
} from "../interfaces/facility-representative.repository.interface";
import { serializeFacilityRepresentative } from "../mappers/facility-representative.mapper";
import { ValidationError } from "../../../../shared/errors";

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

export class CreateFacilityRepresentativeUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    scope: ScopeContext;
    userId: string;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: FacilityRepresentativeContactType;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const name = input.representativeName.trim();
    if (!name) {
      throw new ValidationError([
        { field: "representativeName", message: "Name is required" },
      ]);
    }

    const created = await this.deps.facilityRepresentativeRepository.createManual({
      facilityId: input.facilityId,
      representativeName: name,
      roleTitle: input.roleTitle?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      contactType: input.contactType,
      confirmedByUserId: input.userId,
    });

    return serializeFacilityRepresentative(created);
  }
}
