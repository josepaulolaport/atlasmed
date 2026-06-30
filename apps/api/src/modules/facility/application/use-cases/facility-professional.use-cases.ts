import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityProfessionalView } from "@atlasmed/access";
import type { FacilityProfessionalRepository } from "../interfaces/facility-professional.repository.interface";

function serializeAssociation(row: {
  id: string;
  professionalId: string;
  facilityId: string;
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
    specialty: string | null;
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
      specialty: row.professional.specialty ?? undefined,
      createdAt: row.professional.createdAt.toISOString(),
      updatedAt: row.professional.updatedAt.toISOString(),
    },
    association: {
      sourceActive: row.sourceActive,
      sourceFirstSeenAt: row.sourceFirstSeenAt?.toISOString(),
      sourceLastSeenAt: row.sourceLastSeenAt?.toISOString(),
      confirmedAt: row.confirmedAt?.toISOString(),
      confirmedByUserId: row.confirmedByUserId ?? undefined,
      pendingConfirmation:
        row.sourceActive && !row.confirmedAt && !row.endedAt,
    },
  };
}

interface Dependencies {
  facilityProfessionalRepository: FacilityProfessionalRepository;
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
