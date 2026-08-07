import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { RELATIONSHIP_LEVEL_MAX } from "@atlasmed/database";
import { normalizeSearchFilterValue } from "../../../../shared/normalize-search-filter";
import {
  buildMeiliFilter,
  eqFilter,
  inFilter,
} from "../../../../infrastructure/search/meili-filter";
import { ServiceUnavailableError } from "../../../../shared/errors";
import type { HealthcareProfessionalRecord } from "../interfaces/healthcare-professional.repository.interface";
import type { HealthcareProfessionalRepository } from "../interfaces/healthcare-professional.repository.interface";
import type { UserPersonRelationshipRepository } from "../interfaces/user-person-relationship.repository.interface";

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
    crmCouncil: professional.crmCouncil ?? undefined,
    crmNumber: professional.crmNumber ?? undefined,
    crmState: professional.crmState ?? undefined,
    facilityIds: professional.facilityIds,
    displayFacility: professional.displayFacility ?? undefined,
    relationshipLevel,
    isPriority: relationshipLevel === RELATIONSHIP_LEVEL_MAX,
    distanceKm: professional.distanceKm ?? undefined,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
  };
}

function parseMeiliPersonIds(
  hits: Array<{ id?: string | number }>
): number[] {
  return hits.flatMap((hit) => {
    const raw = hit.id;
    if (typeof raw === "number" && Number.isFinite(raw)) return [raw];
    if (typeof raw === "string" && /^\d+$/.test(raw)) return [Number(raw)];
    return [];
  });
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
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const sort = input.sort ?? "name";
    const order = input.order ?? "asc";

    if (input.facilityId) {
      assertResourceInScope(input.scope, "facility", input.facilityId);
    }

    const scope = input.scope.isGlobal
      ? { isGlobal: true as const }
      : { isGlobal: false as const, facilityIds: input.scope.facilityIds };
    const search = input.search?.trim();

    if (!search) {
      const { professionals, total } =
        await this.deps.healthcareProfessionalRepository.findAll({
          page,
          limit,
          search: input.search,
          facilityId: input.facilityId,
          specialty: input.specialty,
          latitude: input.latitude,
          longitude: input.longitude,
          radiusKm: input.radiusKm,
          sort,
          order,
          scope,
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
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    const searchService = this.deps.searchService;
    if (!searchService?.isConfigured()) {
      throw new ServiceUnavailableError("Search");
    }

    let result: { hits: Array<{ id?: string | number }>; estimatedTotalHits?: number };
    try {
      const canonicalFilters = [
        input.specialty
          ? eqFilter(
              "specialtyNormalized",
              normalizeSearchFilterValue(input.specialty)
            )
          : undefined,
        input.facilityId
          ? eqFilter("activeFacilityIds", input.facilityId)
          : undefined,
      ];
      const scopeFilter = input.scope.isGlobal
        ? undefined
        : input.scope.facilityIds.length > 0
          ? inFilter("activeFacilityIds", input.scope.facilityIds)
          : eqFilter("activeFacilityIds", -1);
      const filter =
        buildMeiliFilter([...canonicalFilters, scopeFilter]) ??
        buildMeiliFilter(canonicalFilters);
      result = await searchService.search("persons", search, {
        limit,
        offset: (page - 1) * limit,
        ...(filter ? { filter } : {}),
      });
    } catch (error) {
      throw new ServiceUnavailableError(
        "Search",
        error instanceof Error ? error : undefined
      );
    }

    const ids = parseMeiliPersonIds(result.hits);
    const professionals = ids.length
      ? orderSearchResultsById(
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
        )
      : [];
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
        serializeSummary(professional, relationshipLevels.get(professional.id))
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
