import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityGeocodingService } from "../services/facility-geocoding.service";
import type { PurchaseRecurrenceCommand, PurchaseRecurrenceService } from "../services/purchase-recurrence.service";
import { ValidationError } from "../../../../shared/errors";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { logger } from "../../../../infrastructure/logging/logger";
import {
  allOfFilter,
  buildMeiliFilter,
  compactFacilityMeiliScopeFilter,
  eqFilter,
  geoRadiusFilter,
  gteFilter,
  inFilter,
  lteFilter,
} from "../../../../infrastructure/search/meili-filter";
import { reportSearchMeiliFallback } from "../../../../infrastructure/search/search-resilience";
import { purchaseBucketToFunnelFilter } from "../list-facilities-query";
import type { FacilityBookmarkRepository } from "../interfaces/facility-bookmark.repository.interface";
import { serializeFacility } from "../mappers/facility.mapper";
import { buildFacilityListScope } from "../utils/facility-vertical-scope.utils";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
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
  deleteDocument?(indexName: string, id: string | number): Promise<unknown>;
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

/** Meili may still ship legacy UUID string ids — only CRM bigints hydrate. */
export function parseMeiliFacilityIds(
  hits: Array<{ id?: string | number }>,
): number[] {
  return hits.flatMap((hit) => {
    const raw = hit.id;
    if (typeof raw === "number" && Number.isFinite(raw)) return [raw];
    if (typeof raw === "string" && /^\d+$/.test(raw)) return [Number(raw)];
    return [];
  });
}

interface Dependencies {
  facilityRepository: FacilityRepository;
  searchService?: SearchService;
  facilityGeocodingService?: FacilityGeocodingService;
  onFacilityLocationChanged?: (facilityId: number) => Promise<void>;
  /** Keep Meili facilities index in sync after create/update (best-effort). */
  onFacilityChanged?: (facilityId: number) => Promise<void>;
  purchaseRecurrenceService?: PurchaseRecurrenceService;
  /**
   * Optional: when wired, the detail response carries `isBookmarked`.
   *
   * Inline rather than a second request, so the icon renders in its true state
   * on first paint. Fetching it separately would show every saved clinic as
   * unsaved for a frame and then flip.
   */
  facilityBookmarkRepository?: FacilityBookmarkRepository;
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
    unitTypeIds?: number[];
    legalDocumentType?: "CNPJ" | "CPF";
    cpfStatus?: "missing" | "invalid";
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

    const listFromSql = async (searchTerm?: string) => {
      const { facilities, total } = await this.deps.facilityRepository.findAll({
        page,
        limit,
        search: searchTerm,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: input.radiusKm,
        commercialStatus: input.commercialStatus,
        purchaseBucket: input.purchaseBucket,
        productIds: input.productIds,
        clinicalFocusIds: input.clinicalFocusIds,
        unitTypeIds: input.unitTypeIds,
        legalDocumentType: input.legalDocumentType,
        cpfStatus: input.cpfStatus,
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
    };

    if (!search) {
      return listFromSql(input.search);
    }

    const searchService = this.deps.searchService;
    if (!searchService?.isConfigured()) {
      return listFromSql(search);
    }

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
        /**
         * Each bound is its own EXISTS in SQL — "has a profile of at least N"
         * and "has a profile of at most M", not necessarily the same profile —
         * so the lower bound tests the largest interval and the upper bound the
         * smallest. Both used to test the minimum, which read as "every profile
         * is at least N" and silently dropped multi-vertical clinics; the
         * hydrate guard only catches Meili returning too many rows, never too
         * few.
         */
        input.purchaseIntervalMinDays !== undefined
          ? gteFilter("purchaseIntervalDaysMax", input.purchaseIntervalMinDays)
          : undefined,
        input.purchaseIntervalMaxDays !== undefined
          ? lteFilter("purchaseIntervalDaysMin", input.purchaseIntervalMaxDays)
          : undefined,
        // OR across the selected unit types, matching the SQL. Both of these
        // are plain facility columns, so the indexed value cannot drift from
        // the row *as long as every writer goes through the application* —
        // the index is maintained by `upsertFacilitySearchDocument` on change,
        // and nothing else refreshes it. A data migration is a writer that
        // does not, and migration 0107 proved it: it corrected seven rows'
        // `unit_type_id` in SQL, and those documents kept answering the old
        // filter until the index was rebuilt. Any migration touching an
        // indexed facility column needs a rebuild alongside it.
        input.unitTypeIds?.length
          ? inFilter("unitTypeId", input.unitTypeIds)
          : undefined,
        input.legalDocumentType
          ? eqFilter("legalDocumentType", input.legalDocumentType)
          : undefined,
        // AND, mirroring the SQL: the clinic must offer every selected focus.
        input.clinicalFocusIds?.length
          ? allOfFilter("clinicalFocusIds", input.clinicalFocusIds)
          : undefined,
      ];
      const verticalFilter =
        listScope.restrictToVerticalProfiles && listScope.verticalIds?.length
          ? inFilter("verticalIds", listScope.verticalIds)
          : undefined;
      const scopeFilter = compactFacilityMeiliScopeFilter({
        isGlobal: listScope.isGlobal,
        role: input.role,
        userId: input.userId,
        oversightZoneIds: input.scope.oversightZoneIds,
        facilityIds: input.scope.facilityIds,
      });
      const filterClauses = [...canonicalFilters, verticalFilter, scopeFilter];
      const filter = buildMeiliFilter(filterClauses);
      if (filterClauses.some(Boolean) && !filter) {
        // Oversized id IN / filters — never drop scope; SQL is authority.
        reportSearchMeiliFallback("facilities", "filter_too_large");
        return listFromSql(search);
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
      const result = await searchService.search<{ id: string | number }>("facilities", search, {
        limit,
        offset: (page - 1) * limit,
        ...(filter ? { filter } : {}),
        ...(searchSort ? { sort: searchSort } : {}),
      });

      const ids = parseMeiliFacilityIds(result.hits);
      // Empty or stale UUID index → SQL substring search (Postgres authority).
      if (result.hits.length === 0) {
        reportSearchMeiliFallback("facilities", "empty_hits");
        return listFromSql(search);
      }
      if (ids.length === 0) {
        reportSearchMeiliFallback("facilities", "unparseable_ids", {
          hitCount: result.hits.length,
        });
        return listFromSql(search);
      }

      const facilities = orderSearchResultsById(
        await this.deps.facilityRepository.findAllByIds({
          ids,
          latitude: input.latitude,
          longitude: input.longitude,
          radiusKm: input.radiusKm,
          commercialStatus: input.commercialStatus,
          purchaseBucket: input.purchaseBucket,
          productIds: input.productIds,
          clinicalFocusIds: input.clinicalFocusIds,
          unitTypeIds: input.unitTypeIds,
          legalDocumentType: input.legalDocumentType,
          cpfStatus: input.cpfStatus,
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
      );
      // Hydrate re-applies authority filters; any drop means Meili over-matched.
      if (facilities.length < ids.length) {
        reportSearchMeiliFallback("facilities", "hydrate_drop", {
          meiliIds: ids.length,
          hydrated: facilities.length,
        });
        return listFromSql(search);
      }
      const total = result.estimatedTotalHits ?? 0;

      return {
        data: facilities.map((f) => serializeFacility(f, listScope.verticalIds)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    } catch (error) {
      reportSearchMeiliFallback("facilities", "meili_error");
      logger.warn("search.meili_error", {
        index: "facilities",
        message: error instanceof Error ? error.message : String(error),
      });
      return listFromSql(search);
    }
  }
}

/**
 * Unit types offered as filter options.
 *
 * Only those some active facility actually has: the CNES table defines 39 and
 * 12 are in use, so listing the catalogue would give reps 27 options that
 * always return nothing.
 */
export class ListFacilityUnitTypesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    const catalog = await this.deps.facilityRepository.listUnitTypesInUse();
    return {
      data: catalog.map((row) => ({
        id: row.id,
        name: row.name,
        cnesCode: row.cnesCode ?? undefined,
      })),
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

/**
 * The unit-type catalog (spec 0014 item 14) — what makes the `unit_type`
 * dashboard filter possible at all.
 *
 * The catalog is populated: 39 types and 91 subtypes, and every one of the
 * 1443 facilities carries a `unit_type_id`. `0055` dropped the old catalogs and
 * `0056` recreated them, but the CNES load did run — so this filter has real
 * options from the day it ships, and the reason it could not ship earlier was
 * only that nothing exposed the names.
 *
 * Returns the catalog whether or not it is populated: an empty list is still
 * the honest answer, because a filter with no options beats a filter whose
 * options are unlabelled ids.
 */
export class ListUnitTypesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    const catalog = await this.deps.facilityRepository.listUnitTypeCatalog();
    return {
      data: catalog.map((row) => ({
        id: row.id,
        cnesId: row.cnesId,
        name: row.name,
        subtypes: row.subtypes.map((subtype) => ({
          id: subtype.id,
          cnesId: subtype.cnesId,
          name: subtype.name,
        })),
      })),
    };
  }
}

export class GetFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    scope: ScopeContext;
    role: string;
    verticalId?: number;
    userId?: number;
  }) {
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

    const bookmarkRepository = this.deps.facilityBookmarkRepository;
    const isBookmarked =
      bookmarkRepository && input.userId
        ? (
            await bookmarkRepository.findBookmarkedIds({
              userId: input.userId,
              facilityIds: [clinic.id],
            })
          ).length > 0
        : false;

    return {
      ...serializeFacility(clinic, listScope.verticalIds, {
        exposeProfileVerticalIds,
      }),
      isBookmarked,
    };
  }
}

export class CreateFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    name: string;
    stateId: number;
    municipalityId: number;
    legalDocumentType: "CNPJ" | "CPF";
    legalDocument?: string | null;
    /**
     * Spec 0009 R5: required. `facilities.location` is NOT NULL, because a clinic
     * with no point cannot be covered by a zone or a patch and so cannot be owned.
     */
    lat: number;
    lng: number;
    /**
     * Spec 0015: required, and it must name an establishment the registry holds.
     *
     * Importing from CNES is the only way a facility comes into existence, so a
     * create with no registry behind it is not a partially-filled record but one
     * the model has no meaning for. `facilities.cnes_code` is NOT NULL, which
     * makes "every facility came from CNES" true regardless of this check; the
     * check adds that the code names something real rather than any string.
     *
     * Optional in the type so a missing one is reported as a field error rather
     * than failing to compile at the route, which passes the body through whole.
     */
    cnesCode?: string;
    /** Required unless the caller has exactly one accessible vertical. */
    verticalId?: number;
    scope: ScopeContext;
    role: string;
  }) {
    const cnesCode = input.cnesCode?.trim();
    if (!cnesCode) {
      throw new ValidationError([
        { field: "cnesCode", message: "cnesCode is required" },
      ]);
    }
    if (!(await this.deps.facilityRepository.registryHasEstablishment(cnesCode))) {
      throw new ValidationError([
        {
          field: "cnesCode",
          message: `CNES ${cnesCode} is not an establishment the registry knows`,
        },
      ]);
    }
    // A facility with no vertical profile is invisible to every non-global
    // scope, so creation must resolve exactly one vertical (spec 0010 §1.7).
    // resolveVerticalIds wraps resolveAccessibleVerticalIds: it throws
    // Forbidden when verticalId is outside the caller's assignments, and
    // returns all assigned verticals when none is supplied.
    const accessibleVerticalIds = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId ?? null,
    });

    if (accessibleVerticalIds.length === 0) {
      throw new ValidationError([{
        field: "verticalId",
        message: "Caller has no accessible verticals to create a clinic in",
      }]);
    }
    if (accessibleVerticalIds.length > 1) {
      throw new ValidationError([{
        field: "verticalId",
        message: "verticalId is required when the caller has multiple verticals",
      }]);
    }
    const verticalId = accessibleVerticalIds[0]!;

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
      legalDocumentType: input.legalDocumentType,
      legalDocument: input.legalDocument,
      lat: coordinates.lat,
      lng: coordinates.lng,
      cnesCode,
      verticalId,
    });

    if (coordinates.lat != null && coordinates.lng != null) {
      await this.deps.onFacilityLocationChanged?.(clinic.id);
    }
    await this.deps.onFacilityChanged?.(clinic.id);

    const refreshed = await this.deps.facilityRepository.findById(clinic.id);
    return serializeFacility(refreshed ?? clinic, [verticalId]);
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
      await this.deps.onFacilityChanged?.(clinic.id);
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
    await this.deps.onFacilityChanged?.(clinic.id);

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

    const searchService = this.deps.searchService;
    if (searchService?.isConfigured() && searchService.deleteDocument) {
      try {
        await searchService.deleteDocument("facilities", String(input.facilityId));
      } catch (error) {
        // Soft-delete already committed; full rebuild eventually heals ghosts.
        logger.warn("search.meili_delete_failed", {
          index: "facilities",
          facilityId: input.facilityId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return true;
  }
}
