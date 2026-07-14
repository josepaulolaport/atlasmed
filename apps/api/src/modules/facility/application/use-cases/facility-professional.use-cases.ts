import type {
  FacilityProfessionalRole,
  FacilityProfessionalView,
  ProfessionalFacilityContext,
  ProfessionalProfile,
  ScopeContext,
} from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityProfessionalRepository } from "../interfaces/facility-professional.repository.interface";
import type { ProfessionalRepository } from "../../../professional/application/interfaces/professional.repository.interface";

function formatDate(value: Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toISOString().slice(0, 10);
}

function serializeAssociationRole(association: {
  id: string;
  facilityId: string;
  professionalId: string;
  occupationCode: string;
  isPartner: boolean;
  isPrescriber: boolean;
  isBuyer: boolean;
  isDecisionMaker: boolean;
  relationshipLevel: number | null;
  specialtyLabel: string | null;
  notes: string | null;
}): FacilityProfessionalRole {
  return {
    facilityProfessionalId: association.id,
    facilityId: association.facilityId,
    professionalId: association.professionalId,
    occupationCode: association.occupationCode,
    isPartner: association.isPartner,
    isPrescriber: association.isPrescriber,
    isBuyer: association.isBuyer,
    isDecisionMaker: association.isDecisionMaker,
    relationshipLevel: association.relationshipLevel ?? undefined,
    specialtyLabel: association.specialtyLabel ?? undefined,
    notes: association.notes ?? undefined,
  };
}

function serializeAssociation(row: {
  id: string;
  professionalId: string;
  facilityId: string;
  occupationCode: string;
  isPartner: boolean;
  isPrescriber: boolean;
  isBuyer: boolean;
  isDecisionMaker: boolean;
  relationshipLevel: number | null;
  specialtyLabel: string | null;
  notes: string | null;
  sourceActive: boolean;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string | null;
    specialty: string | null;
    crmNumber: string | null;
    crmState: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  return {
    facilityProfessionalId: row.id,
    professional: {
      id: row.professional.id,
      firstName: row.professional.firstName,
      lastName: row.professional.lastName,
      fullName: row.professional.fullName ?? undefined,
      specialty: row.professional.specialty ?? undefined,
      crmNumber: row.professional.crmNumber ?? undefined,
      crmState: row.professional.crmState ?? undefined,
      createdAt: row.professional.createdAt.toISOString(),
      updatedAt: row.professional.updatedAt.toISOString(),
    },
    association: {
      ...serializeAssociationRole(row),
      sourceActive: row.sourceActive,
      sourceFirstSeenAt: row.sourceFirstSeenAt?.toISOString(),
      sourceLastSeenAt: row.sourceLastSeenAt?.toISOString(),
      confirmedAt: row.confirmedAt?.toISOString(),
      confirmedByUserId: row.confirmedByUserId ?? undefined,
      pendingConfirmation: row.sourceActive && !row.confirmedAt && !row.endedAt,
    },
  };
}

function serializeProfessionalFromContext(
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string | null;
    socialName: string | null;
    taxId: string | null;
    birthDate: Date | null;
    mobilePhone: string | null;
    landlinePhone: string | null;
    email: string | null;
    websiteUrl: string | null;
    imageUrl: string | null;
    primarySpecialtyLabel: string | null;
    crmCouncil: string | null;
    crmNumber: string | null;
    crmState: string | null;
    favoriteTeam: string | null;
    favoriteSport: string | null;
    hobbies: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  facilityIds: string[],
  facilities: Array<{ id: string; name: string }>
): ProfessionalProfile {
  return {
    id: professional.id,
    firstName: professional.firstName,
    lastName: professional.lastName,
    fullName: professional.fullName ?? undefined,
    socialName: professional.socialName ?? undefined,
    taxId: professional.taxId ?? undefined,
    birthDate: formatDate(professional.birthDate),
    mobilePhone: professional.mobilePhone ?? undefined,
    landlinePhone: professional.landlinePhone ?? undefined,
    email: professional.email ?? undefined,
    websiteUrl: professional.websiteUrl ?? undefined,
    imageUrl: professional.imageUrl ?? undefined,
    primarySpecialtyLabel: professional.primarySpecialtyLabel ?? undefined,
    specialty: professional.primarySpecialtyLabel ?? undefined,
    crmCouncil: professional.crmCouncil ?? undefined,
    crmNumber: professional.crmNumber ?? undefined,
    crmState: professional.crmState ?? undefined,
    favoriteTeam: professional.favoriteTeam ?? undefined,
    favoriteSport: professional.favoriteSport ?? undefined,
    hobbies: professional.hobbies ?? undefined,
    notes: professional.notes ?? undefined,
    facilityIds,
    facilities,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
  };
}

interface Dependencies {
  facilityProfessionalRepository: FacilityProfessionalRepository;
  professionalRepository?: ProfessionalRepository;
}

export class ListFacilityProfessionalsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    scope: ScopeContext;
    view?: FacilityProfessionalView;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const view = input.view ?? "all";

    const { associations, total } =
      await this.deps.facilityProfessionalRepository.findActiveByFacilityWithProfessionals({
        facilityId: input.facilityId,
        view,
        page,
        limit,
        search: input.search,
      });

    return {
      data: associations.map(serializeAssociation),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export class GetFacilityProfessionalContextUseCase {
  constructor(private readonly deps: Required<Dependencies>) {}

  async execute(input: {
    facilityId: string;
    professionalId: string;
    scope: ScopeContext;
  }): Promise<ProfessionalFacilityContext | null> {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const context = await this.deps.facilityProfessionalRepository.findActiveWithProfessional(
      input.facilityId,
      input.professionalId
    );

    if (!context) {
      return null;
    }

    const facilities = await this.deps.professionalRepository.findActiveFacilities(
      input.professionalId
    );

    return {
      professional: serializeProfessionalFromContext(
        context.professional,
        facilities.map((facility) => facility.id),
        facilities
      ),
      association: serializeAssociationRole(context.association),
      facilities,
    };
  }
}

export class UpdateFacilityProfessionalRoleUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    professionalId: string;
    scope: ScopeContext;
    isPartner?: boolean;
    isPrescriber?: boolean;
    isBuyer?: boolean;
    isDecisionMaker?: boolean;
    relationshipLevel?: number | null;
    specialtyLabel?: string | null;
    notes?: string | null;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const association = await this.deps.facilityProfessionalRepository.updateAssociationRoles({
      professionalId: input.professionalId,
      facilityId: input.facilityId,
      data: {
        isPartner: input.isPartner,
        isPrescriber: input.isPrescriber,
        isBuyer: input.isBuyer,
        isDecisionMaker: input.isDecisionMaker,
        relationshipLevel: input.relationshipLevel,
        specialtyLabel: input.specialtyLabel,
        notes: input.notes,
      },
    });

    if (!association) {
      return null;
    }

    return serializeAssociationRole(association);
  }
}

export class ConfirmProfessionalAtFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    professionalId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const association = await this.deps.facilityProfessionalRepository.confirmAssociation({
      professionalId: input.professionalId,
      facilityId: input.facilityId,
      confirmedByUserId: input.userId,
    });

    return {
      facilityProfessionalId: association.id,
      professionalId: association.professionalId,
      facilityId: association.facilityId,
      confirmedAt: association.confirmedAt?.toISOString(),
    };
  }
}

export class ManuallyAssociateProfessionalUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    professionalId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const association = await this.deps.facilityProfessionalRepository.manuallyAssociate({
      professionalId: input.professionalId,
      facilityId: input.facilityId,
      confirmedByUserId: input.userId,
    });

    return {
      facilityProfessionalId: association.id,
      professionalId: association.professionalId,
      facilityId: association.facilityId,
      confirmedAt: association.confirmedAt?.toISOString(),
    };
  }
}

export class EndFacilityProfessionalUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    professionalId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const association = await this.deps.facilityProfessionalRepository.endAssociation({
      professionalId: input.professionalId,
      facilityId: input.facilityId,
      endedByUserId: input.userId,
      endReason: "manual",
    });

    if (!association) {
      return null;
    }

    return {
      facilityProfessionalId: association.id,
      endedAt: association.endedAt?.toISOString(),
    };
  }
}
