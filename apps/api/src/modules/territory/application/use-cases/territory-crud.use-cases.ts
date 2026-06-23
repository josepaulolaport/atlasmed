import { Role } from "@atlasmed/access";
import type { TerritoryNodeType } from "@atlasmed/database";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import { TerritoryCodeGenerator } from "../services/territory-code-generator.service";
import { TerritoryHierarchyValidator } from "../services/territory-hierarchy-validator.service";
import { TerritoryClosureService } from "../services/territory-closure.service";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";

interface TerritoryCrudDependencies {
  territoryRepository: TerritoryRepository;
  closureRepository: TerritoryClosureRepository;
  spatialRepository: TerritorySpatialRepository;
  codeGenerator?: TerritoryCodeGenerator;
  hierarchyValidator?: TerritoryHierarchyValidator;
  closureService?: TerritoryClosureService;
}

function serializeTerritory(territory: {
  id: string;
  name: string;
  code: string;
  nodeType: TerritoryNodeType;
  regionSlug: string | null;
  stateCode: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  activeChildCount?: number;
  clinicCount?: number;
  assignedUserCount?: number;
  hasBoundary?: boolean;
}) {
  return {
    id: territory.id,
    name: territory.name,
    code: territory.code,
    nodeType: territory.nodeType,
    typeIndicator: territory.nodeType,
    regionSlug: territory.regionSlug ?? undefined,
    stateCode: territory.stateCode ?? undefined,
    parentId: territory.parentId ?? undefined,
    isActive: territory.isActive,
    clinicCount: territory.clinicCount ?? 0,
    assignedUserCount: territory.assignedUserCount ?? 0,
    hasBoundary: territory.hasBoundary ?? false,
    isLeaf: (territory.activeChildCount ?? 0) === 0,
    createdAt: territory.createdAt.toISOString(),
    updatedAt: territory.updatedAt.toISOString(),
  };
}

export class TerritoryCrudUseCases {
  private readonly codeGenerator: TerritoryCodeGenerator;
  private readonly hierarchyValidator: TerritoryHierarchyValidator;
  private readonly closureService: TerritoryClosureService;

  constructor(private readonly deps: TerritoryCrudDependencies) {
    this.codeGenerator = deps.codeGenerator ?? new TerritoryCodeGenerator();
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
    nodeType: TerritoryNodeType;
    parentId?: string;
    regionSlug?: string;
    stateCode?: string;
  }) {
    const parent = input.parentId
      ? await this.deps.territoryRepository.findById(input.parentId)
      : null;

    if (input.parentId && !parent) {
      throw new ResourceNotFoundError("Territory", input.parentId);
    }

    const hasActiveRoot = !!(await this.deps.territoryRepository.findActiveRoot());

    this.hierarchyValidator.validateCreate({
      nodeType: input.nodeType,
      parent,
      regionSlug: input.regionSlug ?? null,
      stateCode: input.stateCode ?? null,
      hasActiveRoot,
    });

    if (parent && parent.nodeType === "patch") {
      const clinicCount = await this.deps.territoryRepository.countClinics(parent.id);
      if (clinicCount > 0) {
        throw new OperationNotAllowedError(
          "create_territory",
          "Parent patch has assigned clinics; migrate clinics before adding children"
        );
      }
      if (await this.deps.spatialRepository.hasBoundary(parent.id)) {
        await this.deps.spatialRepository.deleteBoundary(parent.id);
      }
    }

    let patchSequence: number | undefined;
    if (input.nodeType === "patch" && input.parentId) {
      patchSequence =
        (await this.deps.territoryRepository.countPatchesUnderParent(input.parentId)) + 1;
    }

    const inheritedRegionSlug =
      input.regionSlug ??
      parent?.regionSlug ??
      (input.nodeType === "region" ? input.regionSlug : null);
    const inheritedStateCode =
      input.stateCode ??
      parent?.stateCode ??
      (input.nodeType === "state" ? input.stateCode : null);

    const code = this.codeGenerator.generateCode({
      nodeType: input.nodeType,
      parentCode: parent?.code ?? null,
      regionSlug: inheritedRegionSlug,
      stateCode: inheritedStateCode,
      name: input.name,
      patchSequence,
    });

    const territory = await this.deps.territoryRepository.create({
      name: input.name,
      code,
      nodeType: input.nodeType,
      parentId: input.parentId ?? null,
      regionSlug:
        input.nodeType === "region"
          ? input.regionSlug ?? null
          : inheritedRegionSlug ?? null,
      stateCode:
        input.nodeType === "state"
          ? input.stateCode ?? null
          : inheritedStateCode ?? null,
    });

    await this.closureService.rebuildSubtree(territory.id);

    return serializeTerritory(await this.enrichTerritory(territory.id));
  }

  async getTerritory(id: string) {
    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      return null;
    }
    return serializeTerritory(await this.enrichTerritory(id));
  }

  async listTerritories(format: "tree" | "flat" = "flat") {
    const territories = await this.deps.territoryRepository.findAllActive();
    const enriched = await Promise.all(
      territories.map(async (t) =>
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

    if (input.isActive === false) {
      await this.validateDeactivate(id);
    }

    if (input.parentId !== undefined && input.parentId !== territory.parentId) {
      if (!input.parentId) {
        if (territory.nodeType !== "root") {
          throw new OperationNotAllowedError(
            "reparent_territory",
            "Only root territory can have no parent"
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
          newParent,
          descendantIds,
        });
      }
    }

    const updated = await this.deps.territoryRepository.update(id, {
      name: input.name,
      parentId: input.parentId,
      isActive: input.isActive,
    });

    if (input.parentId !== undefined && input.parentId !== territory.parentId) {
      await this.closureService.rebuildSubtree(id);
    }

    return serializeTerritory(await this.enrichTerritory(updated.id));
  }

  async deactivateTerritory(id: string) {
    return this.updateTerritory(id, { isActive: false });
  }

  async getDescendants(id: string) {
    const territory = await this.deps.territoryRepository.findById(id);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", id);
    }

    const descendantIds = await this.deps.closureRepository.findDescendantIds(
      [id],
      true
    );

    return {
      territoryId: id,
      descendantIds: descendantIds.filter((descendantId) => descendantId !== id),
    };
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

    const [activeChildCount, clinicCount, assignedUserCount, hasBoundary] =
      await Promise.all([
        this.deps.territoryRepository.countActiveChildren(id),
        this.deps.territoryRepository.countClinics(id),
        this.deps.territoryRepository.countAssignedUsers(id),
        this.deps.spatialRepository.hasBoundary(id),
      ]);

    return {
      ...territory,
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

export function isAdminRole(role: Role): boolean {
  return role === Role.ADMIN;
}

export function isManagerRole(role: Role): boolean {
  return role === Role.MANAGER;
}
