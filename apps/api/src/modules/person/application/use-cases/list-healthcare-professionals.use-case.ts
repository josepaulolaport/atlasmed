import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { RELATIONSHIP_LEVEL_MAX } from "@atlasmed/database";
import { logger } from "../../../../infrastructure/logging/logger";
import {
  buildMeiliFilter,
  compactPersonMeiliScopeFilter,
  eqFilter,
  orGroup,
} from "../../../../infrastructure/search/meili-filter";
import { reportSearchMeiliFallback } from "../../../../infrastructure/search/search-resilience";
import type { HealthcareProfessionalRecord } from "../interfaces/healthcare-professional.repository.interface";
import type { HealthcareProfessionalRepository } from "../interfaces/healthcare-professional.repository.interface";
import type { UserPersonRelationshipRepository } from "../interfaces/user-person-relationship.repository.interface";
import { parseSpecialtyFilterValues } from "../specialty-filter";

type SearchService = {
  isConfigured(): boolean;
  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    options: {
      limit: number;
      offset: number;
      filter?: string;
      sort?: string[];
    }
  ): Promise<{ hits: T[]; estimatedTotalHits?: number }>;
};

interface Dependencies {
  healthcareProfessionalRepository: HealthcareProfessionalRepository;
  userPersonRelationshipRepository?: UserPersonRelationshipRepository;
  searchService?: SearchService;
}

type ListScope =
  | { isGlobal: true }
  | { isGlobal: false; facilityIds: number[] };

function orderSearchResultsById<T extends { id: number }>(
  records: T[],
  ids: number[]
): T[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  return ids.flatMap((id) => {
    const record = recordsById.get(id);
    return record ? [record] : [];
  });
}

function serializeSummary(
  professional: HealthcareProfessionalRecord,
  relationshipLevel?: number
) {
  const fullName = `${professional.firstName} ${professional.lastName}`.trim();
  return {
    id: professional.id,
    firstName: professional.firstName,
    lastName: professional.lastName,
    fullName,
    specialty: professional.specialty ?? undefined,
    primarySpecialtyLabel: professional.specialty ?? undefined,
    facilityIds: professional.facilityIds,
    displayFacility: professional.displayFacility ?? undefined,
    relationshipLevel,
    isPriority: relationshipLevel === RELATIONSHIP_LEVEL_MAX,
    distanceKm: professional.distanceKm ?? undefined,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
  };
}

export function parseMeiliPersonIds(
  hits: Array<{ id?: string | number }>
): number[] {
  return hits.flatMap((hit) => {
    const raw = hit.id;
    if (typeof raw === "number" && Number.isFinite(raw)) return [raw];
    if (typeof raw === "string" && /^\d+$/.test(raw)) return [Number(raw)];
    return [];
  });
}

function specialtyMeiliFilter(specialty?: string) {
  const values = parseSpecialtyFilterValues(specialty);
  if (values.length === 0) return undefined;
  if (values.length === 1) {
    return eqFilter("specialtyNormalized", values[0]!);
  }
  return orGroup(values.map((value) => eqFilter("specialtyNormalized", value)));
}

export class ListHealthcareProfessionalsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    facilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    sort?: string;
    order?: "asc" | "desc";
    userId?: number;
    role?: string;
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const sort = input.sort ?? "name";
    const order = input.order ?? "asc";

    if (input.facilityId) {
      assertResourceInScope(input.scope, "facility", input.facilityId);
    }

    const scope: ListScope = input.scope.isGlobal
      ? { isGlobal: true }
      : { isGlobal: false, facilityIds: input.scope.facilityIds };
    const search = input.search?.trim();

    if (!search) {
      return this.listFromSql({ ...input, page, limit, sort, order, scope });
    }

    const searchService = this.deps.searchService;
    if (!searchService?.isConfigured()) {
      return this.listFromSql({
        ...input,
        page,
        limit,
        sort,
        order,
        scope,
        search,
      });
    }

    try {
      const canonicalFilters = [
        specialtyMeiliFilter(input.specialty),
        input.facilityId
          ? eqFilter("activeFacilityIds", input.facilityId)
          : undefined,
      ];
      const scopeFilter = compactPersonMeiliScopeFilter({
        isGlobal: input.scope.isGlobal,
        role: input.role,
        oversightZoneIds: input.scope.oversightZoneIds,
        facilityIds: input.scope.facilityIds,
      });
      const filterClauses = [...canonicalFilters, scopeFilter];
      const filter = buildMeiliFilter(filterClauses);
      // Never strip scope when the Meili expression is too large — SQL is authority.
      if (filterClauses.some(Boolean) && !filter) {
        reportSearchMeiliFallback("persons", "filter_too_large");
        return this.listFromSql({
          ...input,
          page,
          limit,
          sort,
          order,
          scope,
          search,
        });
      }

      const result = await searchService.search("persons", search, {
        limit,
        offset: (page - 1) * limit,
        ...(filter ? { filter } : {}),
      });

      const ids = parseMeiliPersonIds(result.hits);
      if (result.hits.length === 0) {
        reportSearchMeiliFallback("persons", "empty_hits");
        return this.listFromSql({
          ...input,
          page,
          limit,
          sort,
          order,
          scope,
          search,
        });
      }
      if (ids.length === 0) {
        reportSearchMeiliFallback("persons", "unparseable_ids", {
          hitCount: result.hits.length,
        });
        return this.listFromSql({
          ...input,
          page,
          limit,
          sort,
          order,
          scope,
          search,
        });
      }

      const professionals = orderSearchResultsById(
        await this.deps.healthcareProfessionalRepository.findAllByIds({
          ids,
          facilityId: input.facilityId,
          specialty: input.specialty,
          latitude: input.latitude,
          longitude: input.longitude,
          radiusKm: input.radiusKm,
          scope,
        }),
        ids
      );
      if (professionals.length < ids.length) {
        reportSearchMeiliFallback("persons", "hydrate_drop", {
          meiliIds: ids.length,
          hydrated: professionals.length,
        });
        return this.listFromSql({
          ...input,
          page,
          limit,
          sort,
          order,
          scope,
          search,
        });
      }

      const total = result.estimatedTotalHits ?? 0;
      const relationshipLevels =
        input.userId && this.deps.userPersonRelationshipRepository
          ? await this.deps.userPersonRelationshipRepository.findLevelsByUserAndPersons(
              input.userId,
              professionals.map((professional) => professional.id)
            )
          : new Map<number, number>();

      return {
        data: professionals.map((professional) =>
          serializeSummary(
            professional,
            relationshipLevels.get(professional.id)
          )
        ),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      reportSearchMeiliFallback("persons", "meili_error");
      logger.warn("search.meili_error", {
        index: "persons",
        message: error instanceof Error ? error.message : String(error),
      });
      return this.listFromSql({
        ...input,
        page,
        limit,
        sort,
        order,
        scope,
        search,
      });
    }
  }

  private async listFromSql(input: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    sort: string;
    order: "asc" | "desc";
    userId?: number;
    scope: ListScope;
  }) {
    const { professionals, total } =
      await this.deps.healthcareProfessionalRepository.findAll({
        page: input.page,
        limit: input.limit,
        search: input.search,
        facilityId: input.facilityId,
        specialty: input.specialty,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: input.radiusKm,
        sort: input.sort,
        order: input.order,
        scope: input.scope,
      });

    const relationshipLevels =
      input.userId && this.deps.userPersonRelationshipRepository
        ? await this.deps.userPersonRelationshipRepository.findLevelsByUserAndPersons(
            input.userId,
            professionals.map((professional) => professional.id)
          )
        : new Map<number, number>();

    return {
      data: professionals.map((professional) =>
        serializeSummary(
          professional,
          relationshipLevels.get(professional.id)
        )
      ),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit) || 1,
      },
    };
  }
}
