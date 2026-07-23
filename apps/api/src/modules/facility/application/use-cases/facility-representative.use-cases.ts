import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type {
  FacilityRepresentativeContactType,
  FacilityRepresentativeRepository,
  FacilityRepresentativeRolePatch,
} from "../interfaces/facility-representative.repository.interface";
import type { UserRepresentativeRelationshipRepository } from "../interfaces/user-representative-relationship.repository.interface";
import { serializeFacilityRepresentative } from "../mappers/facility-representative.mapper";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";

interface Dependencies {
  facilityRepresentativeRepository: FacilityRepresentativeRepository;
  userRepresentativeRelationshipRepository: UserRepresentativeRelationshipRepository;
}

function pickRoles(input: FacilityRepresentativeRolePatch): FacilityRepresentativeRolePatch | undefined {
  const keys: (keyof FacilityRepresentativeRolePatch)[] = [
    "isPartner",
    "isAdministrator",
    "isDecisionMaker",
    "isBuyer",
    "isBiller",
    "isSecretary",
  ];
  const patch: FacilityRepresentativeRolePatch = {};
  let any = false;
  for (const key of keys) {
    if (input[key] !== undefined) {
      patch[key] = input[key];
      any = true;
    }
  }
  return any ? patch : undefined;
}

export class ListFacilityRepresentativesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    scope: ScopeContext;
    userId: string;
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

    const levels =
      await this.deps.userRepresentativeRelationshipRepository.findLevelsByUserAndRepresentatives(
        input.userId,
        result.items.map((item) => item.id)
      );

    return {
      data: result.items.map((item) =>
        serializeFacilityRepresentative(item, levels.get(item.id) ?? null)
      ),
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
    isPartner?: boolean;
    isAdministrator?: boolean;
    isDecisionMaker?: boolean;
    isBuyer?: boolean;
    isBiller?: boolean;
    isSecretary?: boolean;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const name = input.representativeName.trim();
    if (!name) {
      throw new ValidationError([
        { field: "representativeName", message: "Name is required" },
      ]);
    }

    const roles = pickRoles(input);
    const created = await this.deps.facilityRepresentativeRepository.createManual({
      facilityId: input.facilityId,
      representativeName: name,
      roleTitle: input.roleTitle?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      contactType: input.contactType,
      roles,
      confirmedByUserId: input.userId,
    });

    return serializeFacilityRepresentative(created, null);
  }
}

export class UpdateFacilityRepresentativeUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    representativeId: string;
    scope: ScopeContext;
    userId: string;
    representativeName?: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: FacilityRepresentativeContactType;
    isPartner?: boolean;
    isAdministrator?: boolean;
    isDecisionMaker?: boolean;
    isBuyer?: boolean;
    isBiller?: boolean;
    isSecretary?: boolean;
    relationshipLevel?: number | null;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const existing =
      await this.deps.facilityRepresentativeRepository.findByIdForFacility(
        input.facilityId,
        input.representativeId
      );
    if (!existing) {
      throw new ResourceNotFoundError(
        "FacilityRepresentative",
        input.representativeId
      );
    }

    const roles = pickRoles(input);
    const name =
      input.representativeName !== undefined
        ? input.representativeName.trim()
        : undefined;
    if (name !== undefined && !name) {
      throw new ValidationError([
        { field: "representativeName", message: "Name is required" },
      ]);
    }

    const updated =
      (await this.deps.facilityRepresentativeRepository.updateManual({
        facilityId: input.facilityId,
        representativeId: input.representativeId,
        representativeName: name,
        roleTitle:
          input.roleTitle !== undefined
            ? input.roleTitle?.trim() || null
            : undefined,
        email:
          input.email !== undefined ? input.email?.trim() || null : undefined,
        phone:
          input.phone !== undefined ? input.phone?.trim() || null : undefined,
        contactType: input.contactType,
        roles,
      })) ?? existing;

    let relationshipLevel: number | null;
    if (input.relationshipLevel !== undefined) {
      if (input.relationshipLevel === null) {
        await this.deps.userRepresentativeRelationshipRepository.deleteByUserAndRepresentative(
          input.userId,
          input.representativeId
        );
        relationshipLevel = null;
      } else {
        const saved =
          await this.deps.userRepresentativeRelationshipRepository.upsert({
            userId: input.userId,
            representativeId: input.representativeId,
            relationshipLevel: input.relationshipLevel,
          });
        relationshipLevel = saved.relationshipLevel;
      }
    } else {
      const existingRel =
        await this.deps.userRepresentativeRelationshipRepository.findByUserAndRepresentative(
          input.userId,
          input.representativeId
        );
      relationshipLevel = existingRel?.relationshipLevel ?? null;
    }

    return serializeFacilityRepresentative(updated, relationshipLevel);
  }
}
