import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "../services/territory-containment.service";
import { isManagerZoneType } from "../constants/territory-roles.constants";
import {
  applyTerritoryBoundary,
  assertBoundaryProvidedForType,
} from "../services/territory-boundary.application";
import { serializeBoundaryResolution } from "../utils/territory-boundary-resolution.utils";
import { assertSinglePolygonForEditableTerritory } from "../utils/territory-boundary.utils";
import { normalizeTerritorySlug } from "../constants/territory-slug.constants";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";

export interface TerritoryDeletionMembershipPort {
  disassociateClinicsForTerritory(territoryId: string): Promise<{ processed: number }>;
}

interface TerritoryCrudDependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  containmentService: TerritoryContainmentService;
  membershipService?: TerritoryDeletionMembershipPort;
  onTerritoryDeactivated?: (territoryId: string) => Promise<void>;
  onBoundaryChanged?: (territoryId: string) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: string) => Promise<void>;
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
  managerTerritoryId: string | null;
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
    territoryTypeId?: string;
    typeSlug?: string;
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

    const slug = normalizeTerritorySlug(input.slug);

    const existingSlug = await this.deps.territoryRepository.findBySlug(slug);
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

  async getTerritory(id: string) {
    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      return null;
    }
    return serializeTerritory(await this.enrichTerritory(id));
  }

  async listTerritories(
    format: "tree" | "flat" = "flat",
    scope?: ScopeContext,
    filters?: { typeSlug?: string; managerTerritoryId?: string }
  ) {
    const territories = await this.deps.territoryRepository.findAllActive();

    let filtered = territories;
    if (scope && !scope.isGlobal) {
      filtered = territories.filter((territory) =>
        scope.effectiveTerritoryIds.includes(territory.id)
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
    id: string,
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

  async deactivateTerritory(id: string) {
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
  async deleteTerritory(id: string) {
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

    if (territoryType.assignsClinics && this.deps.membershipService) {
      await this.deps.membershipService.disassociateClinicsForTerritory(id);
    }

    return this.deactivateTerritory(id);
  }

  private async validateDeactivate(
    id: string,
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

/** Alias kept for readability at call sites that read a single territory. */
export const assertManagerReadableTerritory = assertManagerReadScope;

export function isAdminRole(role: Role): boolean {
  return role === Role.ADMIN;
}

export function isManagerRole(role: Role): boolean {
  return role === Role.MANAGER;
}
