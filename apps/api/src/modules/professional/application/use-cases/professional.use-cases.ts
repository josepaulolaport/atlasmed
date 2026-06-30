import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ForbiddenError, ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { ProfessionalRepository } from "../interfaces/professional.repository.interface";

function serializeDoctor(doctor: {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  facilityIds: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doctor.id,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    specialty: doctor.specialty ?? undefined,
    facilityIds: doctor.facilityIds,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}

function assertFacilityIdsInScope(scope: ScopeContext, facilityIds: string[]): void {
  if (scope.isGlobal) {
    return;
  }

  for (const facilityId of facilityIds) {
    assertResourceInScope(scope, "facility", facilityId);
  }
}

function assertProfessionalAccessible(scope: ScopeContext, facilityIds: string[]): void {
  if (scope.isGlobal) {
    return;
  }

  const hasAccessibleFacility = facilityIds.some((facilityId) =>
    scope.facilityIds.includes(facilityId)
  );

  if (!hasAccessibleFacility) {
    throw new ForbiddenError("Professional outside scope");
  }
}

interface Dependencies {
  doctorRepository: ProfessionalRepository;
}

export class ListProfessionalsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    facilityId?: string;
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (input.facilityId) {
      assertResourceInScope(input.scope, "facility", input.facilityId);
    }

    const { professionals, total } = await this.deps.doctorRepository.findAll({
      page,
      limit,
      search: input.search,
      facilityId: input.facilityId,
      scope: input.scope.isGlobal
        ? { isGlobal: true }
        : { isGlobal: false, facilityIds: input.scope.facilityIds },
    });

    return {
      data: professionals.map(serializeDoctor),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export class GetProfessionalUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { professionalId: string; scope: ScopeContext }) {
    const doctor = await this.deps.doctorRepository.findById(input.professionalId);

    if (!doctor) {
      return null;
    }

    assertProfessionalAccessible(input.scope, doctor.facilityIds);

    return serializeDoctor(doctor);
  }
}

export class CreateDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    firstName: string;
    lastName: string;
    specialty?: string;
    facilityIds?: string[];
    scope: ScopeContext;
  }) {
    const facilityIds = input.facilityIds ?? [];

    if (facilityIds.length > 0) {
      assertFacilityIdsInScope(input.scope, facilityIds);

      const existingClinicIds = await this.deps.doctorRepository.findExistingClinicIds(
        facilityIds
      );

      if (existingClinicIds.length !== facilityIds.length) {
        throw new ResourceNotFoundError("Clinic", "one or more facilityIds");
      }
    }

    const doctor = await this.deps.doctorRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      specialty: input.specialty ?? null,
      facilityIds,
    });

    return serializeDoctor(doctor);
  }
}

export class UpdateDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    professionalId: string;
    scope: ScopeContext;
    firstName?: string;
    lastName?: string;
    specialty?: string | null;
    facilityIds?: string[];
  }) {
    const existing = await this.deps.doctorRepository.findById(input.professionalId);

    if (!existing) {
      return null;
    }

    assertProfessionalAccessible(input.scope, existing.facilityIds);

    if (input.facilityIds) {
      throw new ValidationError([
        {
          field: "facilityIds",
          message:
            "Use clinic association endpoints to manage facility-professional links",
        },
      ]);
    }

    const doctor = await this.deps.doctorRepository.update(input.professionalId, {
      firstName: input.firstName,
      lastName: input.lastName,
      specialty: input.specialty,
      manuallyEditedAt: new Date(),
    });

    return serializeDoctor(doctor);
  }
}

export class DeleteDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { professionalId: string; scope: ScopeContext }) {
    const existing = await this.deps.doctorRepository.findById(input.professionalId);

    if (!existing) {
      return false;
    }

    assertProfessionalAccessible(input.scope, existing.facilityIds);

    await this.deps.doctorRepository.softDelete(input.professionalId);
    return true;
  }
}
