import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { ClinicRepository } from "../interfaces/clinic.repository.interface";

function serializeClinic(clinic: {
  id: string;
  name: string;
  address: string | null;
  territoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address ?? undefined,
    territoryId: clinic.territoryId ?? undefined,
    createdAt: clinic.createdAt.toISOString(),
    updatedAt: clinic.updatedAt.toISOString(),
  };
}

interface Dependencies {
  clinicRepository: ClinicRepository;
}

export class ListClinicsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { clinics, total } = await this.deps.clinicRepository.findAll({
      page,
      limit,
      search: input.search,
      scope: input.scope.isGlobal
        ? { isGlobal: true }
        : { isGlobal: false, clinicIds: input.scope.clinicIds },
    });

    return {
      data: clinics.map(serializeClinic),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export class GetClinicUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { clinicId: string; scope: ScopeContext }) {
    const clinic = await this.deps.clinicRepository.findById(input.clinicId);

    if (!clinic) {
      return null;
    }

    assertResourceInScope(input.scope, "clinic", clinic.id);

    return serializeClinic(clinic);
  }
}

export class CreateClinicUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    name: string;
    address?: string;
    territoryId?: string;
  }) {
    const clinic = await this.deps.clinicRepository.create({
      name: input.name,
      address: input.address ?? null,
      territoryId: input.territoryId ?? null,
    });

    return serializeClinic(clinic);
  }
}

export class UpdateClinicUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    clinicId: string;
    scope: ScopeContext;
    name?: string;
    address?: string | null;
    territoryId?: string | null;
  }) {
    assertResourceInScope(input.scope, "clinic", input.clinicId);

    const existing = await this.deps.clinicRepository.findById(input.clinicId);
    if (!existing) {
      return null;
    }

    const clinic = await this.deps.clinicRepository.update(input.clinicId, {
      name: input.name,
      address: input.address,
      territoryId: input.territoryId,
      manuallyEditedAt: new Date(),
    });

    return serializeClinic(clinic);
  }
}

export class DeleteClinicUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { clinicId: string; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "clinic", input.clinicId);

    const existing = await this.deps.clinicRepository.findById(input.clinicId);
    if (!existing) {
      return false;
    }

    await this.deps.clinicRepository.softDelete(input.clinicId);
    return true;
  }
}
