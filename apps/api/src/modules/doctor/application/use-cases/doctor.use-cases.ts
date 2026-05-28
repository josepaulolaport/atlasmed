import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ForbiddenError, ResourceNotFoundError } from "../../../../shared/errors";
import type { DoctorRepository } from "../interfaces/doctor.repository.interface";

function serializeDoctor(doctor: {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  clinicIds: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doctor.id,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    specialty: doctor.specialty ?? undefined,
    clinicIds: doctor.clinicIds,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}

function assertClinicIdsInScope(scope: ScopeContext, clinicIds: string[]): void {
  if (scope.isGlobal) {
    return;
  }

  for (const clinicId of clinicIds) {
    assertResourceInScope(scope, "clinic", clinicId);
  }
}

function assertDoctorAccessible(scope: ScopeContext, clinicIds: string[]): void {
  if (scope.isGlobal) {
    return;
  }

  const hasAccessibleClinic = clinicIds.some((clinicId) =>
    scope.clinicIds.includes(clinicId)
  );

  if (!hasAccessibleClinic) {
    throw new ForbiddenError("Doctor outside scope");
  }
}

interface Dependencies {
  doctorRepository: DoctorRepository;
}

export class ListDoctorsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    clinicId?: string;
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (input.clinicId) {
      assertResourceInScope(input.scope, "clinic", input.clinicId);
    }

    const { doctors, total } = await this.deps.doctorRepository.findAll({
      page,
      limit,
      search: input.search,
      clinicId: input.clinicId,
      scope: input.scope.isGlobal
        ? { isGlobal: true }
        : { isGlobal: false, clinicIds: input.scope.clinicIds },
    });

    return {
      data: doctors.map(serializeDoctor),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export class GetDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { doctorId: string; scope: ScopeContext }) {
    const doctor = await this.deps.doctorRepository.findById(input.doctorId);

    if (!doctor) {
      return null;
    }

    assertDoctorAccessible(input.scope, doctor.clinicIds);

    return serializeDoctor(doctor);
  }
}

export class CreateDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    firstName: string;
    lastName: string;
    specialty?: string;
    clinicIds: string[];
    scope: ScopeContext;
  }) {
    assertClinicIdsInScope(input.scope, input.clinicIds);

    const existingClinicIds = await this.deps.doctorRepository.findExistingClinicIds(
      input.clinicIds
    );

    if (existingClinicIds.length !== input.clinicIds.length) {
      throw new ResourceNotFoundError("Clinic", "one or more clinicIds");
    }

    const doctor = await this.deps.doctorRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      specialty: input.specialty ?? null,
      clinicIds: input.clinicIds,
    });

    return serializeDoctor(doctor);
  }
}

export class UpdateDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    doctorId: string;
    scope: ScopeContext;
    firstName?: string;
    lastName?: string;
    specialty?: string | null;
    clinicIds?: string[];
  }) {
    const existing = await this.deps.doctorRepository.findById(input.doctorId);

    if (!existing) {
      return null;
    }

    assertDoctorAccessible(input.scope, existing.clinicIds);

    if (input.clinicIds) {
      assertClinicIdsInScope(input.scope, input.clinicIds);

      const existingClinicIds = await this.deps.doctorRepository.findExistingClinicIds(
        input.clinicIds
      );

      if (existingClinicIds.length !== input.clinicIds.length) {
        throw new ResourceNotFoundError("Clinic", "one or more clinicIds");
      }
    }

    const doctor = await this.deps.doctorRepository.update(input.doctorId, {
      firstName: input.firstName,
      lastName: input.lastName,
      specialty: input.specialty,
      clinicIds: input.clinicIds,
    });

    return serializeDoctor(doctor);
  }
}

export class DeleteDoctorUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { doctorId: string; scope: ScopeContext }) {
    const existing = await this.deps.doctorRepository.findById(input.doctorId);

    if (!existing) {
      return false;
    }

    assertDoctorAccessible(input.scope, existing.clinicIds);

    await this.deps.doctorRepository.softDelete(input.doctorId);
    return true;
  }
}
