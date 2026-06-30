import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import { TerritoryHierarchyValidator } from "../services/territory-hierarchy-validator.service";
import { TerritoryClosureService } from "../services/territory-closure.service";
import type { TerritoryGeoParentService } from "../services/territory-geo-parent.service";
import type { TerritoryGeoMembershipService } from "../services/territory-geo-membership.service";
import { isOperationalTerritoryType } from "../constants/territory-geo-membership.constants";
import {
  applyTerritoryBoundary,
  assertBoundaryProvidedForType,
} from "../services/territory-boundary.application";
import { serializeBoundaryResolution } from "../utils/territory-boundary-resolution.utils";
import { normalizeCountryCode } from "../constants/territory-geo.constants";
import {
  legacyNodeTypeForTypeSlug,
  normalizeTerritorySlug,
} from "../constants/territory-slug.constants";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import {
  assertTerritoryReadable,
  resolveReadableTerritoryIds,
} from "../services/territory-scope-policy.service";

interface TerritoryCrudDependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  closureRepository: TerritoryClosureRepository;
  spatialRepository: TerritorySpatialRepository;
  geoParentService: TerritoryGeoParentService;
  geoMembershipService: TerritoryGeoMembershipService;
  hierarchyValidator?: TerritoryHierarchyValidator;
  closureService?: TerritoryClosureService;
  onTerritoryDeactivated?: (territoryId: string) => Promise<void>;
  onBoundaryChanged?: (territoryId: string) => Promise<void>;
}

function serializeTerritoryType(type: NonNullable<Awaited<ReturnType<TerritoryTypeRepository["findById"]>>>) {
  return {
    id: type.id,
    slug: type.slug,
    name: type.name,
    description: type.description ?? undefined,
    canHaveBoundary: type.canHaveBoundary,
    assignsClinics: type.assignsClinics,
    assignableToUsers: type.assignableToUsers,
    assignableToManagers: type.assignableToManagers,
    isCountryLevel: type.isCountryLevel,
    blockSiblingOverlap: type.blockSiblingOverlap,
    sortOrder: type.sortOrder,
    isActive: type.isActive,
  };
}

function serializeTerritory(territory: {
  id: string;
  name: string;
  slug: string;
  code: string;
  territoryTypeId: string;
  territoryType?: NonNullable<Awaited<ReturnType<TerritoryTypeRepository["findById"]>>>;
  countryCode: string | null;
  parentId: string | null;
  isActive: boolean;
  parentAssignmentStatus: string;
  parentAssignmentSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  activeChildCount?: number;
  clinicCount?: number;
  assignedUserCount?: number;
  hasBoundary?: boolean;
}) {
  if (!territory.territoryType) {
    throw new Error(`Territory ${territory.id} is missing territoryType`);
  }

  return {
    id: territory.id,
    name: territory.name,
    slug: territory.slug,
    code: territory.code,
    territoryTypeId: territory.territoryTypeId,
    territoryType: serializeTerritoryType(territory.territoryType),
    countryCode: territory.countryCode ?? undefined,
    parentId: territory.parentId ?? undefined,
    isActive: territory.isActive,
    parentAssignmentStatus: territory.parentAssignmentStatus,
    parentAssignmentSource: territory.parentAssignmentSource ?? undefined,
    clinicCount: territory.clinicCount ?? 0,
    assignedUserCount: territory.assignedUserCount ?? 0,
    hasBoundary: territory.hasBoundary ?? false,
    isLeaf: (territory.activeChildCount ?? 0) === 0,
    isCountryLevel: territory.territoryType.isCountryLevel,
    createdAt: territory.createdAt.toISOString(),
    updatedAt: territory.updatedAt.toISOString(),
  };
}

export class TerritoryCrudUseCases {
  private readonly hierarchyValidator: TerritoryHierarchyValidator;
  private readonly closureService: TerritoryClosureService;

  constructor(private readonly deps: TerritoryCrudDependencies) {
    this.hierarchyValidator =
      deps.hierarchyValidator ?? new TerritoryHierarchyValidator();
    this.closureService =
      deps.closureService ??
      new TerritoryClosureService({
        territoryRepository: deps.territoryRepository,
        closureRepository: deps.closureRepository,
      });
  }

  async createTerritory(input: {
    name: string;
    slug: string;
    territoryTypeId?: string;
    typeSlug?: string;
    countryCode?: string;
    parentId?: string;
    boundary?: GeoJsonGeometry;
  }) {
    const type = input.territoryTypeId
      ? await this.deps.territoryTypeRepository.findById(input.territoryTypeId)
      : input.typeSlug
        ? await this.deps.territoryTypeRepository.findBySlug(input.typeSlug)
        : null;

    if (!type || !type.isActive) {
      throw new ResourceNotFoundError(
        "TerritoryType",
        input.territoryTypeId ?? input.typeSlug ?? "unknown"
      );
    }

    let parent = null;
    if (input.parentId) {
      parent = await this.deps.territoryRepository.findById(input.parentId);
      if (!parent) {
        throw new ResourceNotFoundError("Territory", input.parentId);
      }
    }

    const countryCode = resolveCountryCode({
      countryCode: input.countryCode,
      slug: input.slug,
      type,
      parent,
    });

    const slug = resolveTerritorySlug({
      slug: input.slug,
      type,
      countryCode,
    });

    const hasActiveCountryForCode = !!(await this.deps.territoryRepository.findActiveCountryByCode(
      countryCode
    ));

    const existingSlug = await this.deps.territoryRepository.findBySlug(slug);
    if (existingSlug) {
      throw new OperationNotAllowedError(
        "create_territory",
        `Territory identifier '${slug}' is already in use`
      );
    }

    this.hierarchyValidator.validateCreate({
      type,
      slug,
      countryCode,
      parent,
      parentId: input.parentId ?? null,
      hasActiveCountryForCode,
    });

    const boundary = assertBoundaryProvidedForType(type.canHaveBoundary, input.boundary);

    let resolvedParentId = type.isCountryLevel ? null : (input.parentId ?? null);
    if (!type.isCountryLevel && !resolvedParentId && isOperationalTerritoryType(type)) {
      const country = await this.deps.territoryRepository.findActiveCountryByCode(countryCode);
      resolvedParentId = country?.id ?? null;
    }

    const territory = await this.deps.territoryRepository.create({
      name: input.name.trim(),
      slug,
      code: slug.toUpperCase(),
      nodeType: legacyNodeTypeForTypeSlug(type.slug),
      territoryTypeId: type.id,
      countryCode,
      parentId: resolvedParentId,
      parentAssignmentSource: resolvedParentId ? "manual" : null,
      parentAssignmentStatus: resolvedParentId ? "resolved" : "ambiguous",
    });

    await this.closureService.rebuildSubtree(territory.id);

    let boundaryResolution:
      | Awaited<ReturnType<typeof applyTerritoryBoundary>>
      | undefined;

    if (type.canHaveBoundary) {
      boundaryResolution = await applyTerritoryBoundary(
        {
          territoryRepository: this.deps.territoryRepository,
          territoryTypeRepository: this.deps.territoryTypeRepository,
          spatialRepository: this.deps.spatialRepository,
          geoParentService: this.deps.geoParentService,
          geoMembershipService: this.deps.geoMembershipService,
          onBoundaryChanged: this.deps.onBoundaryChanged,
        },
        { ...territory, territoryType: type },
        boundary
      );
    }

    const serialized = serializeTerritory(await this.enrichTerritory(territory.id));

    if (!boundaryResolution) {
      return serialized;
    }

    return {
      ...serialized,
      boundaryResolution: serializeBoundaryResolution(boundaryResolution),
    };
  }

  async getTerritory(id: string) {
    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      return null;
    }
    return serializeTerritory(await this.enrichTerritory(id));
  }

  async listTerritories(
    format: "tree" | "flat" = "flat",
    scope?: ScopeContext
  ) {
    const territories = await this.deps.territoryRepository.findAllActive();

    let filtered = territories;
    if (scope && !scope.isGlobal) {
      const readableIds = await resolveReadableTerritoryIds(
        scope,
        this.deps.closureRepository
      );
      filtered =
        readableIds === null
          ? territories
          : territories.filter((territory) => readableIds.has(territory.id));
    }

    const enriched = await Promise.all(
      filtered.map(async (t) =>
        serializeTerritory(await this.enrichTerritory(t.id))
      )
    );

    if (format === "flat") {
      return { data: enriched };
    }

    return { data: this.buildTree(enriched) };
  }

  async updateTerritory(
    id: string,
    input: {
      name?: string;
      parentId?: string | null;
      isActive?: boolean;
    }
  ) {
    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", id);
    }

    const territoryType =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!territoryType) {
      throw new ResourceNotFoundError("TerritoryType", territory.territoryTypeId);
    }

    if (input.isActive === false) {
      await this.validateDeactivate(id);
    }

    if (input.parentId !== undefined && input.parentId !== territory.parentId) {
      if (!input.parentId) {
        if (!territoryType.isCountryLevel) {
          throw new OperationNotAllowedError(
            "reparent_territory",
            "Only country-level territories can have no parent"
          );
        }
      } else {
        const newParent = await this.deps.territoryRepository.findById(input.parentId);
        if (!newParent) {
          throw new ResourceNotFoundError("Territory", input.parentId);
        }
        const descendantIds = await this.deps.closureRepository.findDescendantIds(
          [id],
          false
        );
        this.hierarchyValidator.validateReparent({
          territory,
          territoryType,
          newParent,
          descendantIds,
        });
      }
    }

    const updated = await this.deps.territoryRepository.update(id, {
      name: input.name,
      parentId: input.parentId,
      isActive: input.isActive,
      ...(input.parentId !== undefined && input.parentId !== territory.parentId
        ? {
            parentAssignmentStatus: input.parentId ? "manual" : territory.parentAssignmentStatus,
            parentAssignmentSource: input.parentId ? "manual" : territory.parentAssignmentSource,
          }
        : {}),
    });

    if (input.parentId !== undefined && input.parentId !== territory.parentId) {
      await this.closureService.rebuildSubtree(id);
    }

    if (input.isActive === false && territory.isActive) {
      await this.deps.onTerritoryDeactivated?.(id);
    }

    return serializeTerritory(await this.enrichTerritory(updated.id));
  }

  async deactivateTerritory(id: string) {
    return this.updateTerritory(id, { isActive: false });
  }

  async getDescendants(id: string, scope?: ScopeContext) {
    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", id);
    }

    if (scope && !scope.isGlobal) {
      const readableIds = await resolveReadableTerritoryIds(
        scope,
        this.deps.closureRepository
      );
      assertTerritoryReadable(readableIds, id);
    }

    const descendantIds = await this.deps.closureRepository.findDescendantIds(
      [id],
      true
    );

    const scopedDescendantIds =
      scope && !scope.isGlobal
        ? descendantIds.filter(
            (descendantId) =>
              descendantId !== id &&
              scope.effectiveTerritoryIds.includes(descendantId)
          )
        : descendantIds.filter((descendantId) => descendantId !== id);

    return {
      territoryId: id,
      descendantIds: scopedDescendantIds,
    };
  }

  async listAmbiguousParentTerritories(scope?: ScopeContext) {
    const territories = await this.deps.territoryRepository.findAmbiguousParentAssignments();

    let filtered = territories;
    if (scope && !scope.isGlobal) {
      const jurisdictionIds = new Set(scope.effectiveTerritoryIds);
      filtered = territories.filter((territory) => jurisdictionIds.has(territory.id));
    }

    const enriched = await Promise.all(
      filtered.map(async (t) => serializeTerritory(await this.enrichTerritory(t.id)))
    );
    return { data: enriched };
  }

  private async validateDeactivate(id: string): Promise<void> {
    const activeChildren = await this.deps.territoryRepository.countActiveChildren(id);
    if (activeChildren > 0) {
      throw new OperationNotAllowedError(
        "deactivate_territory",
        "Territory has active children"
      );
    }

    const clinicCount = await this.deps.territoryRepository.countClinics(id);
    if (clinicCount > 0) {
      throw new OperationNotAllowedError(
        "deactivate_territory",
        "Territory has assigned clinics"
      );
    }

    const assignedUsers = await this.deps.territoryRepository.countAssignedUsers(id);
    if (assignedUsers > 0) {
      throw new OperationNotAllowedError(
        "deactivate_territory",
        "Territory has assigned users"
      );
    }
  }

  private async enrichTerritory(id: string) {
    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", id);
    }

    const territoryType =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!territoryType) {
      throw new ResourceNotFoundError("TerritoryType", territory.territoryTypeId);
    }

    const [activeChildCount, clinicCount, assignedUserCount, hasBoundary] =
      await Promise.all([
        this.deps.territoryRepository.countActiveChildren(id),
        this.deps.territoryRepository.countClinics(id),
        this.deps.territoryRepository.countAssignedUsers(id),
        this.deps.spatialRepository.hasBoundary(id),
      ]);

    return {
      ...territory,
      territoryType,
      activeChildCount,
      clinicCount,
      assignedUserCount,
      hasBoundary,
    };
  }

  private buildTree(
    territories: ReturnType<typeof serializeTerritory>[]
  ): Array<ReturnType<typeof serializeTerritory> & { children: unknown[] }> {
    const byId = new Map(
      territories.map((t) => [t.id, { ...t, children: [] as unknown[] }])
    );
    const roots: Array<ReturnType<typeof serializeTerritory> & { children: unknown[] }> =
      [];

    for (const territory of byId.values()) {
      if (territory.parentId && byId.has(territory.parentId)) {
        byId.get(territory.parentId)!.children.push(territory);
      } else {
        roots.push(territory);
      }
    }

    return roots;
  }
}

export function assertManagerReadScope(
  scope: { isGlobal: boolean; effectiveTerritoryIds: string[] },
  territoryId: string
): void {
  if (scope.isGlobal) {
    return;
  }

  if (!scope.effectiveTerritoryIds.includes(territoryId)) {
    throw new OperationNotAllowedError("read_territory", "Territory outside manager scope");
  }
}

export async function assertManagerReadableTerritory(
  scope: ScopeContext,
  territoryId: string,
  closureRepository: TerritoryClosureRepository
): Promise<void> {
  if (scope.isGlobal) {
    return;
  }

  const readableIds = await resolveReadableTerritoryIds(scope, closureRepository);
  assertTerritoryReadable(readableIds, territoryId);
}

export function isAdminRole(role: Role): boolean {
  return role === Role.ADMIN;
}

export function isManagerRole(role: Role): boolean {
  return role === Role.MANAGER;
}

function resolveCountryCode(input: {
  countryCode?: string;
  slug: string;
  type: { isCountryLevel: boolean };
  parent: { countryCode: string | null } | null;
}): string {
  if (input.countryCode?.trim()) {
    return normalizeCountryCode(input.countryCode);
  }

  if (input.parent?.countryCode) {
    return normalizeCountryCode(input.parent.countryCode);
  }

  if (input.type.isCountryLevel && input.slug.trim()) {
    return normalizeCountryCode(input.slug);
  }

  return normalizeCountryCode(undefined);
}

function resolveTerritorySlug(input: {
  slug: string;
  type: { isCountryLevel: boolean };
  countryCode: string;
}): string {
  if (input.type.isCountryLevel) {
    return normalizeTerritorySlug(input.countryCode);
  }

  return normalizeTerritorySlug(input.slug);
}
