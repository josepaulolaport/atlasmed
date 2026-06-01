import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { DoctorClinicView } from "@atlasmed/access";
import type { DoctorClinicAssociationRepository } from "../interfaces/doctor-clinic-association.repository.interface";

function serializeAssociation(row: {
  id: string;
  doctorId: string;
  clinicId: string;
  sourceActive: boolean;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    specialty: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  return {
    associationId: row.id,
    doctor: {
      id: row.doctor.id,
      firstName: row.doctor.firstName,
      lastName: row.doctor.lastName,
      specialty: row.doctor.specialty ?? undefined,
      createdAt: row.doctor.createdAt.toISOString(),
      updatedAt: row.doctor.updatedAt.toISOString(),
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
  associationRepository: DoctorClinicAssociationRepository;
}

export class ListClinicDoctorsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    clinicId: string;
    scope: ScopeContext;
    view?: DoctorClinicView;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    assertResourceInScope(input.scope, "clinic", input.clinicId);

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const view = input.view ?? "all";

    const { associations, total } =
      await this.deps.associationRepository.findActiveByClinicWithDoctors({
        clinicId: input.clinicId,
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

export class ConfirmDoctorAtClinicUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    clinicId: string;
    doctorId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "clinic", input.clinicId);

    const association = await this.deps.associationRepository.confirmAssociation({
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      confirmedByUserId: input.userId,
    });

    return {
      associationId: association.id,
      doctorId: association.doctorId,
      clinicId: association.clinicId,
      confirmedAt: association.confirmedAt?.toISOString(),
    };
  }
}

export class ManuallyAssociateDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    clinicId: string;
    doctorId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "clinic", input.clinicId);

    const association = await this.deps.associationRepository.manuallyAssociate({
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      confirmedByUserId: input.userId,
    });

    return {
      associationId: association.id,
      doctorId: association.doctorId,
      clinicId: association.clinicId,
      confirmedAt: association.confirmedAt?.toISOString(),
    };
  }
}

export class EndDoctorClinicAssociationUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    clinicId: string;
    doctorId: string;
    userId: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "clinic", input.clinicId);

    const association = await this.deps.associationRepository.endAssociation({
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      endedByUserId: input.userId,
      endReason: "manual",
    });

    if (!association) {
      return null;
    }

    return {
      associationId: association.id,
      endedAt: association.endedAt?.toISOString(),
    };
  }
}
