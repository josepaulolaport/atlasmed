import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityGeocodingService } from "../services/facility-geocoding.service";
import { ServiceUnavailableError } from "../../../../shared/errors";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { buildMeiliFilter, eqFilter, geoRadiusFilter, inFilter } from "../../../../infrastructure/search/meili-filter";
import { serializeFacility } from "../mappers/facility.mapper";
import { buildFacilityListScope } from "../utils/facility-vertical-scope.utils";

export interface SearchService {
  isConfigured(): boolean;
  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options: { limit: number; offset: number; filter?: string; sort?: string[] }
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
    sort?: "relevance" | "distance";
    scope: ScopeContext;
    role: string;
    verticalId?: string;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const listScope = buildFacilityListScope({
      scope: input.scope,
      role: input.role,
      verticalId: input.verticalId,
    });
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
        scope: listScope,
      });

      return {
        data: facilities.map((f) => serializeFacility(f, listScope.verticalIds)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }

    const searchService = this.deps.searchService;
    if (!searchService?.isConfigured()) {
      throw new ServiceUnavailableError("Search");
    }

    let result: { hits: Array<{ id: string }>; estimatedTotalHits?: number };
    try {
      const canonicalFilters = [
        input.commercialStatus ? eqFilter("commercialStatus", input.commercialStatus) : undefined,
        input.radiusKm !== undefined && input.latitude !== undefined && input.longitude !== undefined
          ? geoRadiusFilter(input.latitude, input.longitude, input.radiusKm * 1_000)
          : undefined,
      ];
      const scopeFilter = listScope.isGlobal
        ? listScope.restrictToVerticalProfiles && listScope.verticalIds?.length
          ? inFilter("id", await this.deps.facilityRepository.findActiveFacilityIdsByVerticalIds(listScope.verticalIds))
          : undefined
        : input.scope.facilityIds.length > 0
          ? inFilter("id", input.scope.facilityIds)
          : eqFilter("id", "__none__");
      const filter = buildMeiliFilter([...canonicalFilters, scopeFilter])
        ?? buildMeiliFilter(canonicalFilters);
      const sort = input.sort === "distance" && input.latitude !== undefined && input.longitude !== undefined
        ? [`_geoPoint(${input.latitude}, ${input.longitude}):asc`]
        : undefined;
      result = await searchService.search<{ id: string }>("facilities", search, {
        limit,
        offset: (page - 1) * limit,
        ...(filter ? { filter } : {}),
        ...(sort ? { sort } : {}),
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
            scope: listScope,
          }),
          ids
        )
      : [];
    const total = result.estimatedTotalHits ?? 0;

    return {
      data: facilities.map((f) => serializeFacility(f, listScope.verticalIds)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class GetFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: string; scope: ScopeContext; role: string; verticalId?: string }) {
    const listScope = buildFacilityListScope({
      scope: input.scope,
      role: input.role,
      verticalId: input.verticalId,
    });

    const clinic = await this.deps.facilityRepository.findById(input.facilityId);

    if (!clinic) {
      return null;
    }

    assertResourceInScope(input.scope, "facility", clinic.id);

    if (listScope.restrictToVerticalProfiles && listScope.verticalIds?.length) {
      const allowed = await this.deps.facilityRepository.findActiveFacilityIdsByVerticalIds(
        listScope.verticalIds,
      );
      if (!allowed.includes(clinic.id)) {
        return null;
      }
    }

    return serializeFacility(clinic, listScope.verticalIds);
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
