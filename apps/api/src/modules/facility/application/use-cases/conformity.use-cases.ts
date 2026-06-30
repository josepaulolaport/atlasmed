import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";

export class ListConformityRequirementsUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute() {
    const requirements = await this.deps.conformityRepository.findActiveRequirements();

    return {
      data: requirements.map((requirement) => ({
        id: requirement.id,
        slug: requirement.slug,
        name: requirement.name,
        description: requirement.description ?? undefined,
        sectorId: requirement.sectorId ?? undefined,
        isActive: requirement.isActive,
        createdAt: requirement.createdAt.toISOString(),
      })),
    };
  }
}

export class ListFacilityConformityRecordsUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const records = await this.deps.conformityRepository.findRecordsByFacility(input.facilityId);

    return {
      data: records.map((record) => ({
        id: record.id,
        facilityId: record.facilityId,
        requirementId: record.requirementId,
        requirement: record.requirement,
        status: record.status,
        submittedAt: record.submittedAt?.toISOString(),
        validatedAt: record.validatedAt?.toISOString(),
        expiresAt: record.expiresAt?.toISOString(),
        validatedByUserId: record.validatedByUserId ?? undefined,
        createdAt: record.createdAt.toISOString(),
      })),
    };
  }
}

export class CreateFacilityConformityRecordUseCase {
  constructor(private readonly deps: { conformityRepository: ConformityRepository }) {}

  async execute(input: {
    facilityId: string;
    requirementId: string;
    scope: ScopeContext;
    status?: "PENDING" | "SUBMITTED";
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const record = await this.deps.conformityRepository.createRecord({
      facilityId: input.facilityId,
      requirementId: input.requirementId,
      status: input.status,
    });

    return {
      id: record.id,
      facilityId: record.facilityId,
      requirementId: record.requirementId,
      requirement: record.requirement,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
