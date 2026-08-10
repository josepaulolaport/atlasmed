import { Role, assertResourceInScope, resolveAccessibleVerticalIds } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "../services/territory-containment.service";
import { isManagerZoneType, isRepPatchType } from "../constants/territory-roles.constants";
import {
  applyTerritoryBoundary,
  assertBoundaryProvidedForType,
} from "../services/territory-boundary.application";
import { serializeBoundaryResolution } from "../utils/territory-boundary-resolution.utils";
import { assertSinglePolygonForEditableTerritory } from "../utils/territory-boundary.utils";
import { normalizeTerritorySlug } from "../constants/territory-slug.constants";
import {
  ForbiddenError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";

/**
 * Spec 0010 §2.1 — the vertical parameter is a filter, never a grant.
 *
 * Returns the vertical ids the caller may operate in, narrowed by `filterVerticalId`
 * when provided, or `null` when no vertical narrowing applies (global scope, or no
 * scope supplied by an internal caller).
 *
 * Global scope (ADMIN) is deliberately not narrowed: spec 0010 §2.3 defers ADMIN
 * vertical scoping, and `createGlobalScopeContext()` carries `assignedVerticalIds: []`,
 * which the helper would otherwise read as "nothing accessible".
 */
function resolveScopedVerticalIds(
  scope: ScopeContext | undefined,
  filterVerticalId?: number | null
): number[] | null {
  if (!scope || scope.isGlobal) {
    return null;
  }

  const result = resolveAccessibleVerticalIds({
    assignedVerticalIds: scope.assignedVerticalIds ?? [],
    filterVerticalId: filterVerticalId ?? null,
  });

  if (!result.ok) {
    throw new ForbiddenError("Vertical outside assignment");
  }

  return result.verticalIds;
}

export interface TerritoryDeletionMembershipPort {
  disassociateClinicsForTerritory(territoryId: number): Promise<{ processed: number }>;
}

interface TerritoryCrudDependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  containmentService: TerritoryContainmentService;
  membershipService?: TerritoryDeletionMembershipPort;
  onTerritoryDeactivated?: (territoryId: number) => Promise<void>;
  onBoundaryChanged?: (territoryId: number) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: number) => Promise<void>;
}

function serializeTerritoryType(type: NonNullable<Awaited<ReturnType<TerritoryTypeRepository["findById"]>>>) {
  return {
    id: type.id,
    slug: type.slug,
    name: type.name,
    description: type.description ?? undefined,
    canHaveBoundary: type.canHaveBoundary,
    blockSiblingOverlap: type.blockSiblingOverlap,
    isActive: type.isActive,
  };
}

function serializeTerritory(territory: {
  id: number;
  name: string;
  slug: string;
  code: string;
  verticalId: number;
  territoryTypeId: number;
  territoryType?: NonNullable<Awaited<ReturnType<TerritoryTypeRepository["findById"]>>>;
  managerTerritoryId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  clinicCount?: number;
  assignedUserCount?: number;
  repPatchCount?: number;
  hasBoundary?: boolean;
}) {
  if (!territory.territoryType) {
    throw new OperationNotAllowedError("serializeTerritory", `Territory ${territory.id} is missing territoryType`);
  }

  return {
    id: territory.id,
    name: territory.name,
    slug: territory.slug,
    code: territory.code,
    verticalId: territory.verticalId,
    territoryTypeId: territory.territoryTypeId,
    territoryType: serializeTerritoryType(territory.territoryType),
    managerTerritoryId: territory.managerTerritoryId ?? undefined,
    isActive: territory.isActive,
    clinicCount: territory.clinicCount ?? 0,
    assignedUserCount: territory.assignedUserCount ?? 0,
    repPatchCount: territory.repPatchCount ?? 0,
    hasBoundary: territory.hasBoundary ?? false,
    createdAt: territory.createdAt.toISOString(),
    updatedAt: territory.updatedAt.toISOString(),
  };
}

export class TerritoryCrudUseCases {
  constructor(private readonly deps: TerritoryCrudDependencies) {}

  async createTerritory(input: {
    name: string;
    slug: string;
    verticalId: number;
    territoryTypeId?: number;
    typeSlug?: string;
    boundary?: GeoJsonGeometry;
    /**
     * Caller scope. Omitted only by internal/admin flows (invite, invitation update)
     * that do not originate from a scoped HTTP request.
     */
    scope?: ScopeContext;
  }) {
    // Spec 0010 §2.2 — a caller may only create territories in their own verticals.
    resolveScopedVerticalIds(input.scope, input.verticalId);

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

    const slug = normalizeTerritorySlug(input.slug);

    const existingSlug = await this.deps.territoryRepository.findBySlug(slug, input.verticalId);
    if (existingSlug) {
      throw new OperationNotAllowedError(
        "create_territory",
        `Territory identifier '${slug}' is already in use`
      );
    }

    const boundary = assertBoundaryProvidedForType(type.canHaveBoundary, input.boundary);
    if (boundary) {
      assertSinglePolygonForEditableTerritory(type, boundary, "create_territory");
    }

    const territory = await this.deps.territoryRepository.create({
      name: input.name.trim(),
      slug,
      code: slug.toUpperCase(),
      verticalId: input.verticalId,
      territoryTypeId: type.id,
    });

    let boundaryResolution:
      | Awaited<ReturnType<typeof applyTerritoryBoundary>>
      | undefined;

    if (type.canHaveBoundary) {
      boundaryResolution = await applyTerritoryBoundary(
        {
          territoryRepository: this.deps.territoryRepository,
          territoryTypeRepository: this.deps.territoryTypeRepository,
          spatialRepository: this.deps.spatialRepository,
          containmentService: this.deps.containmentService,
          onBoundaryChanged: this.deps.onBoundaryChanged,
          onManagerTerritoryChanged: this.deps.onManagerTerritoryChanged,
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

  async getTerritory(id: number, scope?: ScopeContext) {
    // Spec 0010 §2.2 — reading a territory by id must respect territory scope.
    if (scope) {
      assertResourceInScope(scope, "territory", id);
    }

    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      return null;
    }
    return serializeTerritory(await this.enrichTerritory(id));
  }

  async listTerritories(
    format: "tree" | "flat" = "flat",
    scope?: ScopeContext,
    filters?: { typeSlug?: string; managerTerritoryId?: number; verticalId?: number }
  ) {
    // Spec 0010 §2.2/§2.1 — `verticalId` may only narrow the caller's assigned set,
    // never widen it. Throws before any query when the filter is not assigned.
    const accessibleVerticalIds = resolveScopedVerticalIds(
      scope,
      filters?.verticalId
    );

    const territories = await this.deps.territoryRepository.findAllActive(
      filters?.verticalId,
    );

    let filtered = territories;
    if (scope && !scope.isGlobal) {
      filtered = territories.filter((territory) =>
        scope.effectiveTerritoryIds.includes(territory.id)
      );
    }

    if (accessibleVerticalIds && accessibleVerticalIds.length > 0) {
      filtered = filtered.filter((territory) =>
        accessibleVerticalIds.includes(territory.verticalId)
      );
    }

    if (filters?.typeSlug) {
      filtered = filtered.filter(
        (t) => t.territoryType?.slug === filters.typeSlug
      );
    }

    if (filters?.managerTerritoryId) {
      filtered = filtered.filter(
        (t) => t.managerTerritoryId === filters.managerTerritoryId
      );
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
    id: number,
    input: {
      name?: string;
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
      await this.validateDeactivate(id, territoryType);
    }

    const updated = await this.deps.territoryRepository.update(id, {
      name: input.name,
      isActive: input.isActive,
    });

    if (input.isActive === false && territory.isActive) {
      await this.deps.onTerritoryDeactivated?.(id);
    }

    return serializeTerritory(await this.enrichTerritory(updated.id));
  }

  async deactivateTerritory(id: number) {
    return this.updateTerritory(id, { isActive: false });
  }

  /**
   * Deletes (deactivates) a territory, automatically disassociating any
   * clinics currently assigned to it via a geo re-match against the
   * remaining active territories (same mechanism used on boundary
   * create/edit). Rep patches, and assigned users still hard-block
   * deletion — those require a deliberate human decision and are not
   * auto-resolved.
   */
  async deleteTerritory(id: number) {
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

    await this.validateDeactivate(id, territoryType, { skipClinicCheck: true });

    if (isRepPatchType(territoryType) && this.deps.membershipService) {
      await this.deps.membershipService.disassociateClinicsForTerritory(id);
    }

    return this.deactivateTerritory(id);
  }

  private async validateDeactivate(
    id: number,
    territoryType: NonNullable<Awaited<ReturnType<TerritoryTypeRepository["findById"]>>>,
    options?: { skipClinicCheck?: boolean }
  ): Promise<void> {
    if (isManagerZoneType(territoryType)) {
      const repPatchCount = await this.deps.territoryRepository.countRepPatchesByManagerZone(id);
      if (repPatchCount > 0) {
        throw new OperationNotAllowedError(
          "deactivate_territory",
          "Manager zone still has active rep patches"
        );
      }
    }

    if (!options?.skipClinicCheck) {
      const clinicCount = await this.deps.territoryRepository.countClinics(id);
      if (clinicCount > 0) {
        throw new OperationNotAllowedError(
          "deactivate_territory",
          "Territory has assigned clinics"
        );
      }
    }

    const assignedUsers = await this.deps.territoryRepository.countAssignedUsers(id);
    if (assignedUsers > 0) {
      throw new OperationNotAllowedError(
        "deactivate_territory",
        "Territory has assigned users"
      );
    }
  }

  private async enrichTerritory(id: number) {
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

    const [clinicCount, assignedUserCount, hasBoundary, repPatchCount] =
      await Promise.all([
        this.deps.territoryRepository.countClinics(id),
        this.deps.territoryRepository.countAssignedUsers(id),
        this.deps.spatialRepository.hasBoundary(id),
        isManagerZoneType(territoryType)
          ? this.deps.territoryRepository.countRepPatchesByManagerZone(id)
          : Promise.resolve(0),
      ]);

    return {
      ...territory,
      territoryType,
      clinicCount,
      assignedUserCount,
      hasBoundary,
      repPatchCount,
    };
  }

  /**
   * "tree" format nests rep patches under their manager zone
   * (via managerTerritoryId); everything else is a root node.
   */
  private buildTree(
    territories: ReturnType<typeof serializeTerritory>[]
  ): Array<ReturnType<typeof serializeTerritory> & { children: unknown[] }> {
    const byId = new Map(
      territories.map((t) => [t.id, { ...t, children: [] as unknown[] }])
    );
    const roots: Array<ReturnType<typeof serializeTerritory> & { children: unknown[] }> =
      [];

    for (const territory of byId.values()) {
      if (territory.managerTerritoryId && byId.has(territory.managerTerritoryId)) {
        byId.get(territory.managerTerritoryId)!.children.push(territory);
      } else {
        roots.push(territory);
      }
    }

    return roots;
  }
}

export function assertManagerReadScope(
  scope: { isGlobal: boolean; effectiveTerritoryIds: number[] },
  territoryId: number
): void {
  if (scope.isGlobal) {
    return;
  }

  if (!scope.effectiveTerritoryIds.includes(territoryId)) {
    throw new OperationNotAllowedError("read_territory", "Territory outside manager scope");
  }
}

/** Alias kept for readability at call sites that read a single territory. */
export const assertManagerReadableTerritory = assertManagerReadScope;

export function isAdminRole(role: Role): boolean {
  return role === Role.ADMIN;
}

export function isManagerRole(role: Role): boolean {
  return role === Role.MANAGER;
}
