import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityGeocodingService } from "../services/facility-geocoding.service";
import { ServiceUnavailableError } from "../../../../shared/errors";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { serializeFacility } from "../mappers/facility.mapper";

export interface SearchService {
  isConfigured(): boolean;
  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options: { limit: number; offset: number }
  ): Promise<{ hits: T[]; estimatedTotalHits?: number }>;
}

export function orderSearchResultsById<T extends { id: string }>(
  records: T[],
  ids: string[]
): T[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => {
    const record = recordsById.get(id);
    return record ? [record] : [];
  });
}

interface Dependencies {
  facilityRepository: FacilityRepository;
  searchService?: SearchService;
  facilityGeocodingService?: FacilityGeocodingService;
  onFacilityLocationChanged?: (facilityId: string) => Promise<void>;
}

export class ListFacilitiesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: "REGISTERED" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
    productIds?: string[];
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const scope = input.scope.isGlobal
      ? { isGlobal: true as const }
      : { isGlobal: false as const, facilityIds: input.scope.facilityIds };
    const search = input.search?.trim();

    if (!search) {
      const { facilities, total } = await this.deps.facilityRepository.findAll({
        page,
        limit,
        search: input.search,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: input.radiusKm,
        commercialStatus: input.commercialStatus,
        productIds: input.productIds,
        scope,
      });

      return {
        data: facilities.map(serializeFacility),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }

    const searchService = this.deps.searchService;
    if (!searchService?.isConfigured()) {
      throw new ServiceUnavailableError("Search");
    }

    let result: { hits: Array<{ id: string }>; estimatedTotalHits?: number };
    try {
      result = await searchService.search<{ id: string }>("facilities", search, {
        limit,
        offset: (page - 1) * limit,
      });
    } catch (error) {
      throw new ServiceUnavailableError("Search", error instanceof Error ? error : undefined);
    }

    const ids = result.hits.map((hit) => hit.id);
    const facilities = ids.length
      ? orderSearchResultsById(
          await this.deps.facilityRepository.findAllByIds({
            ids,
            latitude: input.latitude,
            longitude: input.longitude,
            radiusKm: input.radiusKm,
            commercialStatus: input.commercialStatus,
            productIds: input.productIds,
            scope,
          }),
          ids
        )
      : [];
    const total = result.estimatedTotalHits ?? 0;

    return {
      data: facilities.map(serializeFacility),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class GetFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    const clinic = await this.deps.facilityRepository.findById(input.facilityId);

    if (!clinic) {
      return null;
    }

    assertResourceInScope(input.scope, "facility", clinic.id);

    return serializeFacility(clinic);
  }
}

export class CreateFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    name: string;
    lat?: number;
    lng?: number;
  }) {
    const coordinates = this.deps.facilityGeocodingService
      ? await this.deps.facilityGeocodingService.resolveCoordinates({
          lat: input.lat,
          lng: input.lng,
        })
      : { lat: input.lat ?? null, lng: input.lng ?? null, geocoded: false };

    const clinic = await this.deps.facilityRepository.create({
      name: input.name,
      lat: coordinates.lat,
      lng: coordinates.lng,
    });

    if (coordinates.lat != null && coordinates.lng != null) {
      await this.deps.onFacilityLocationChanged?.(clinic.id);
    }

    const refreshed = await this.deps.facilityRepository.findById(clinic.id);
    return serializeFacility(refreshed ?? clinic);
  }
}

export class UpdateFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    scope: ScopeContext;
    name?: string;
    lat?: number | null;
    lng?: number | null;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const existing = await this.deps.facilityRepository.findById(input.facilityId);
    if (!existing) {
      return null;
    }

    const coordinates = this.deps.facilityGeocodingService
      ? await this.deps.facilityGeocodingService.resolveCoordinates({
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

    const clinic = await this.deps.facilityRepository.update(input.facilityId, {
      name: input.name,
      lat: coordinates.lat,
      lng: coordinates.lng,
      manuallyEditedAt: new Date(),
    });

    if (locationChanged) {
      await this.deps.onFacilityLocationChanged?.(clinic.id);
    }

    const refreshed = await this.deps.facilityRepository.findById(clinic.id);
    return serializeFacility(refreshed ?? clinic);
  }
}

export class DeleteFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const existing = await this.deps.facilityRepository.findById(input.facilityId);
    if (!existing) {
      return false;
    }

    await this.deps.facilityRepository.softDelete(input.facilityId);
    return true;
  }
}
