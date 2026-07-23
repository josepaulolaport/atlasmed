import { Role } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { SectorRepository } from "../../../catalog/application/interfaces/sector.repository.interface";
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
  ValidationError,
} from "../../../../shared/errors";

export interface TerritoryDeletionMembershipPort {
  disassociateClinicsForTerritory(territoryId: string): Promise<{ processed: number }>;
}

interface TerritoryCrudDependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  containmentService: TerritoryContainmentService;
  sectorRepository?: SectorRepository;
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
  sectorId?: string | null;
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
    sectorId: territory.sectorId ?? undefined,
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
    sectorId?: string;
    /** Preferred manager zone for rep patches (from client picker). */
    managerTerritoryId?: string;
    boundary?: GeoJsonGeometry;
  }) {
    // Prefer id when present, but fall back to slug so a stale/wrong id
    // from the client does not fail create when `typeSlug` is still valid.
    const typeById = input.territoryTypeId
      ? await this.deps.territoryTypeRepository.findById(input.territoryTypeId)
      : null;
    const typeBySlug = input.typeSlug
      ? await this.deps.territoryTypeRepository.findBySlug(input.typeSlug)
      : null;
    const type = typeById?.isActive ? typeById : typeBySlug?.isActive ? typeBySlug : null;
    const typeRef = input.territoryTypeId ?? input.typeSlug;

    if (!type) {
      throw new ValidationError([
        {
          field: input.territoryTypeId && !typeById ? "territoryTypeId" : "typeSlug",
          message: typeRef
            ? `Invalid territory type "${typeRef}". Expected an active type such as manager_zone or patch.`
            : "Invalid territory type. Provide territoryTypeId or typeSlug.",
        },
      ]);
    }

    if (input.sectorId) {
      await this.assertSectorValid(input.sectorId);
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
      sectorId: input.sectorId ?? null,
    });

    let boundaryResolution:
      | Awaited<ReturnType<typeof applyTerritoryBoundary>>
      | undefined;

    if (type.canHaveBoundary) {
      // Create must not auto-reassign clinics (or cascade membership). That
      // stays an explicit recompute / later boundary-edit concern.
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
        boundary,
        {
          preferredManagerTerritoryId: input.managerTerritoryId,
          enqueueClinicRecompute: false,
        }
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
    filters?: { typeSlug?: string; managerTerritoryId?: string; sectorId?: string }
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

    if (filters?.sectorId) {
      filtered = filtered.filter((t) => t.sectorId === filters.sectorId);
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
      sectorId?: string | null;
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

    if (input.sectorId) {
      await this.assertSectorValid(input.sectorId);
    }

    const updated = await this.deps.territoryRepository.update(id, {
      name: input.name,
      isActive: input.isActive,
      sectorId: input.sectorId,
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

  private async assertSectorValid(sectorId: string): Promise<void> {
    if (!this.deps.sectorRepository) {
      return;
    }
    const sector = await this.deps.sectorRepository.findById(sectorId);
    if (!sector || !sector.isActive) {
      throw new ResourceNotFoundError("Sector", sectorId);
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
