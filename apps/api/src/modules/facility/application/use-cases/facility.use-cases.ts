import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityGeocodingService } from "../services/facility-geocoding.service";
import type { PurchaseRecurrenceCommand, PurchaseRecurrenceService } from "../services/purchase-recurrence.service";
import { ValidationError } from "../../../../shared/errors";
import { ServiceUnavailableError } from "../../../../shared/errors";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { buildMeiliFilter, eqFilter, geoRadiusFilter, gteFilter, inFilter, lteFilter } from "../../../../infrastructure/search/meili-filter";
import { purchaseBucketToFunnelFilter } from "../list-facilities-query";
import { serializeFacility } from "../mappers/facility.mapper";
import { buildFacilityListScope } from "../utils/facility-vertical-scope.utils";
import {
  meiliFunnelStageFilter,
  meiliPurchaseProfileFilter,
} from "../utils/meili-funnel-filter.utils";

export interface SearchService {
  isConfigured(): boolean;
  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options: { limit: number; offset: number; filter?: string; sort?: string[] }
  ): Promise<{ hits: T[]; estimatedTotalHits?: number }>;
}

export function orderSearchResultsById<T extends { id: number }>(
  records: T[],
  ids: number[]
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
  onFacilityLocationChanged?: (facilityId: number) => Promise<void>;
  purchaseRecurrenceService?: PurchaseRecurrenceService;
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
    commercialStatus?: "UNREGISTERED" | "REGISTERED" | "SUSPENDED" | "CLOSED";
    purchaseBucket?: "active" | "inactive" | "neverBought";
    productIds?: number[];
    clinicalFocusIds?: number[];
    purchaseFunnelStages?: ("NEVER_PURCHASED" | "OUTSIDE_WINDOW" | "PURCHASE_WINDOW" | "CHURN" | "INACTIVE")[];
    purchaseProfile?: "AUTOMATIC" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";
    purchaseIntervalMinDays?: number;
    purchaseIntervalMaxDays?: number;
    sort?: "relevance" | "distance" | "name" | "purchaseFunnelStage" | "purchaseIntervalDays" | "lastPurchaseDate";
    order?: "asc" | "desc";
    userId: number;
    scope: ScopeContext;
    role: string;
    verticalId?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const sort = input.sort ?? (input.search?.trim() ? "relevance" : "name");
    const order = input.order ?? (sort === "relevance" ? "desc" : "asc");

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
        purchaseBucket: input.purchaseBucket,
        productIds: input.productIds,
        clinicalFocusIds: input.clinicalFocusIds,
        purchaseFunnelStages: input.purchaseFunnelStages,
        purchaseProfile: input.purchaseProfile,
        purchaseIntervalMinDays: input.purchaseIntervalMinDays,
        purchaseIntervalMaxDays: input.purchaseIntervalMaxDays,
        sort,
        order,
        userId: input.userId,
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

    let result: { hits: Array<{ id: number }>; estimatedTotalHits?: number };
    try {
      // commercialStatus remains canonical-Postgres-only; recurrence filters are indexed.
      const purchaseBucketFunnel = input.purchaseBucket
        ? purchaseBucketToFunnelFilter(input.purchaseBucket)
        : undefined;
      const purchaseBucketMeiliFilter = purchaseBucketFunnel
        ? meiliFunnelStageFilter(
            listScope.verticalIds,
            purchaseBucketFunnel.stages,
            { includeNull: purchaseBucketFunnel.includeNull },
          )
        : undefined;
      const canonicalFilters = [
        input.radiusKm !== undefined && input.latitude !== undefined && input.longitude !== undefined
          ? geoRadiusFilter(input.latitude, input.longitude, input.radiusKm * 1_000)
          : undefined,
        input.purchaseFunnelStages?.length
          ? meiliFunnelStageFilter(listScope.verticalIds, input.purchaseFunnelStages)
          : purchaseBucketMeiliFilter,
        input.purchaseProfile
          ? meiliPurchaseProfileFilter(listScope.verticalIds, input.purchaseProfile)
          : undefined,
        input.purchaseIntervalMinDays !== undefined
          ? gteFilter("purchaseIntervalDaysMin", input.purchaseIntervalMinDays)
          : undefined,
        input.purchaseIntervalMaxDays !== undefined
          ? lteFilter("purchaseIntervalDaysMin", input.purchaseIntervalMaxDays)
          : undefined,
      ];
      const verticalFilter =
        listScope.restrictToVerticalProfiles && listScope.verticalIds?.length
          ? inFilter("verticalIds", listScope.verticalIds)
          : undefined;
      const scopeFilter = listScope.isGlobal
        ? undefined
        : input.scope.facilityIds.length > 0
          ? inFilter("id", input.scope.facilityIds)
          : eqFilter("id", -1);
      const filterClauses = [...canonicalFilters, verticalFilter, scopeFilter];
      const filter = buildMeiliFilter(filterClauses);
      if (filterClauses.some(Boolean) && !filter) {
        const { facilities, total } = await this.deps.facilityRepository.findAll({
          page, limit, search, latitude: input.latitude, longitude: input.longitude,
          radiusKm: input.radiusKm, commercialStatus: input.commercialStatus,
          purchaseBucket: input.purchaseBucket,
          productIds: input.productIds,
          clinicalFocusIds: input.clinicalFocusIds,
          purchaseFunnelStages: input.purchaseFunnelStages,
          purchaseProfile: input.purchaseProfile, purchaseIntervalMinDays: input.purchaseIntervalMinDays,
          purchaseIntervalMaxDays: input.purchaseIntervalMaxDays, sort, order,
          userId: input.userId,
          scope: listScope,
        });
        return {
          data: facilities.map((f) => serializeFacility(f, listScope.verticalIds)),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
        };
      }
      const searchSort = sort === "distance" && input.latitude !== undefined && input.longitude !== undefined
        ? [`_geoPoint(${input.latitude}, ${input.longitude}):${order}`]
        : sort === "purchaseFunnelStage"
          ? [`purchaseFunnelStageRank:${order}`, "name:asc", "id:asc"]
          : sort === "purchaseIntervalDays"
            ? [`purchaseIntervalDaysMin:${order}`, "name:asc", "id:asc"]
            : sort === "lastPurchaseDate"
              ? ["hasLastValidPurchase:desc", `lastValidPurchaseSortAt:${order}`, "name:asc", "id:asc"]
              : sort === "name"
                ? [`name:${order}`, "id:asc"]
                : undefined;
      result = await searchService.search<{ id: number }>("facilities", search, {
        limit,
        offset: (page - 1) * limit,
        ...(filter ? { filter } : {}),
        ...(searchSort ? { sort: searchSort } : {}),
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
            purchaseBucket: input.purchaseBucket,
            productIds: input.productIds,
            clinicalFocusIds: input.clinicalFocusIds,
            purchaseFunnelStages: input.purchaseFunnelStages,
            purchaseProfile: input.purchaseProfile,
            purchaseIntervalMinDays: input.purchaseIntervalMinDays,
            purchaseIntervalMaxDays: input.purchaseIntervalMaxDays,
            sort: input.sort,
            order: input.order,
            userId: input.userId,
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

export class ListClinicalFocusesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    const catalog = await this.deps.facilityRepository.listClinicalFocusCatalog();
    return {
      data: catalog.map((row) => ({
        id: row.id,
        name: row.name,
        cnesCode: row.cnesCode ?? undefined,
      })),
    };
  }
}

export class GetFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: number; scope: ScopeContext; role: string; verticalId?: number }) {
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

    // Detail access uses territory scope + any assigned Linha profile.
    // Do NOT hard-deny on the narrow verticalId filter — that Linha only
    // scopes commercial/funnel fields. Otherwise opening an Orto clinic while
    // Explorar is on Derm 404s before profiles can load for the switcher.
    const assignedVerticalIds = input.scope.assignedVerticalIds ?? [];
    if (!input.scope.isGlobal && assignedVerticalIds.length > 0) {
      const hasAssignedProfile = (clinic.verticalProfiles ?? []).some(
        (profile) =>
          profile.isActive && assignedVerticalIds.includes(profile.verticalId),
      );
      if (!hasAssignedProfile) {
        return null;
      }
    }

    // Detail: scope commercial/funnel to active Linha, but expose every
    // user-assigned profile so the mobile Linha switcher can flip Orto↔Derm.
    const exposeProfileVerticalIds =
      assignedVerticalIds.length > 0
        ? assignedVerticalIds
        : listScope.verticalIds;

    return serializeFacility(clinic, listScope.verticalIds, {
      exposeProfileVerticalIds,
    });
  }
}

export class CreateFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    name: string;
    stateId: number;
    municipalityId: number;
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
      stateId: input.stateId,
      municipalityId: input.municipalityId,
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
    facilityId: number;
    scope: ScopeContext;
    name?: string;
    lat?: number | null;
    lng?: number | null;
    purchaseRecurrence?: PurchaseRecurrenceCommand;
    /** Required when updating purchaseRecurrence for multi-vertical clinics. */
    verticalId?: number;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const existing = await this.deps.facilityRepository.findById(input.facilityId);
    if (!existing) {
      return null;
    }

    if (input.purchaseRecurrence) {
      if (input.lat !== undefined || input.lng !== undefined) {
        throw new ValidationError([{ field: "purchaseRecurrence", message: "Purchase recurrence cannot be updated with coordinates" }]);
      }
      if (!this.deps.purchaseRecurrenceService) {
        throw new ValidationError([{ field: "purchaseRecurrence", message: "Purchase recurrence is unavailable" }]);
      }
      const profiles = (existing.verticalProfiles ?? []).filter((p) => p.isActive);
      const verticalId =
        input.verticalId
        ?? input.scope.activeVerticalId
        ?? (profiles.length === 1 ? profiles[0]!.verticalId : undefined);
      if (!verticalId) {
        throw new ValidationError([{
          field: "verticalId",
          message: "verticalId is required when configuring purchase recurrence",
        }]);
      }
      const configuration = this.deps.purchaseRecurrenceService.prepareConfiguration(input.purchaseRecurrence);
      const clinic = await this.deps.purchaseRecurrenceService.updateFacility(
        input.facilityId,
        verticalId,
        {
          fields: { name: input.name },
          configuration,
          today: new Date().toISOString().slice(0, 10),
        },
      );
      return serializeFacility(clinic, [verticalId]);
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

  async execute(input: { facilityId: number; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const existing = await this.deps.facilityRepository.findById(input.facilityId);
    if (!existing) {
      return false;
    }

    await this.deps.facilityRepository.softDelete(input.facilityId);
    return true;
  }
}
