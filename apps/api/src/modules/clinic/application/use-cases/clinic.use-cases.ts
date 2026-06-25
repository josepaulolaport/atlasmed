import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { ClinicGeocodingService } from "../services/clinic-geocoding.service";
import type { ClinicRepository } from "../interfaces/clinic.repository.interface";

function serializeClinic(clinic: {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address ?? undefined,
    lat: clinic.lat ?? undefined,
    lng: clinic.lng ?? undefined,
    territoryId: clinic.territoryId ?? undefined,
    territoryAssignmentStatus: clinic.territoryAssignmentStatus,
    createdAt: clinic.createdAt.toISOString(),
    updatedAt: clinic.updatedAt.toISOString(),
  };
}

interface Dependencies {
  clinicRepository: ClinicRepository;
  clinicGeocodingService?: ClinicGeocodingService;
  onClinicLocationChanged?: (clinicId: string) => Promise<void>;
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
    lat?: number;
    lng?: number;
  }) {
    const coordinates = this.deps.clinicGeocodingService
      ? await this.deps.clinicGeocodingService.resolveCoordinates({
          address: input.address,
          lat: input.lat,
          lng: input.lng,
        })
      : { lat: input.lat ?? null, lng: input.lng ?? null, geocoded: false };

    const clinic = await this.deps.clinicRepository.create({
      name: input.name,
      address: input.address ?? null,
      lat: coordinates.lat,
      lng: coordinates.lng,
    });

    if (coordinates.lat != null && coordinates.lng != null) {
      await this.deps.onClinicLocationChanged?.(clinic.id);
    }

    const refreshed = await this.deps.clinicRepository.findById(clinic.id);
    return serializeClinic(refreshed ?? clinic);
  }
}

export class UpdateClinicUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    clinicId: string;
    scope: ScopeContext;
    name?: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }) {
    assertResourceInScope(input.scope, "clinic", input.clinicId);

    const existing = await this.deps.clinicRepository.findById(input.clinicId);
    if (!existing) {
      return null;
    }

    const nextAddress = input.address !== undefined ? input.address : existing.address;
    const coordinates = this.deps.clinicGeocodingService
      ? await this.deps.clinicGeocodingService.resolveCoordinates({
          address: nextAddress,
          lat: input.lat !== undefined ? input.lat : existing.lat,
          lng: input.lng !== undefined ? input.lng : existing.lng,
        })
      : {
          lat: input.lat !== undefined ? input.lat : existing.lat,
          lng: input.lng !== undefined ? input.lng : existing.lng,
          geocoded: false,
        };

    const locationChanged =
      coordinates.lat !== existing.lat || coordinates.lng !== existing.lng;

    const clinic = await this.deps.clinicRepository.update(input.clinicId, {
      name: input.name,
      address: input.address,
      lat: coordinates.lat,
      lng: coordinates.lng,
      manuallyEditedAt: new Date(),
    });

    if (locationChanged) {
      await this.deps.onClinicLocationChanged?.(clinic.id);
    }

    const refreshed = await this.deps.clinicRepository.findById(clinic.id);
    return serializeClinic(refreshed ?? clinic);
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
