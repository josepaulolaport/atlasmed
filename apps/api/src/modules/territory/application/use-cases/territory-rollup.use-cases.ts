import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritoryRollupRepository } from "../interfaces/territory-rollup.repository.interface";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerReadableTerritory } from "./territory-crud.use-cases";

function serializeRollupLink(link: {
  id: string;
  territoryId: string;
  ancestorId: string;
  relationshipType: string;
  source?: "geo" | "manual";
  createdAt: Date;
  ancestor?: {
    id: string;
    name: string;
    code: string;
    slug: string;
    territoryType: {
      slug: string;
      name: string;
    };
  };
}) {
  return {
    id: link.id,
    territoryId: link.territoryId,
    ancestorId: link.ancestorId,
    relationshipType: link.relationshipType,
    source: link.source,
    createdAt: link.createdAt.toISOString(),
    ancestor: link.ancestor,
  };
}

export class TerritoryRollupUseCases {
  constructor(
    private readonly deps: {
      territoryRepository: TerritoryRepository;
      closureRepository: TerritoryClosureRepository;
      rollupRepository: TerritoryRollupRepository;
    }
  ) {}

  async listRollupLinks(territoryId: string, scope?: ScopeContext) {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    if (scope && !scope.isGlobal) {
      await assertManagerReadableTerritory(
        scope,
        territoryId,
        this.deps.closureRepository
      );
    }

    const links = await this.deps.rollupRepository.listByTerritoryId(territoryId);
    return { data: links.map(serializeRollupLink) };
  }

  async addRollupLink(input: {
    territoryId: string;
    ancestorId: string;
    relationshipType?: "reporting";
  }) {
    const territory = await this.deps.territoryRepository.findById(input.territoryId);
    if (!territory || !territory.isActive) {
      throw new ResourceNotFoundError("Territory", input.territoryId);
    }

    const ancestor = await this.deps.territoryRepository.findById(input.ancestorId);
    if (!ancestor || !ancestor.isActive) {
      throw new ResourceNotFoundError("Territory", input.ancestorId);
    }

    if (input.territoryId === input.ancestorId) {
      throw new OperationNotAllowedError(
        "add_rollup_link",
        "Territory cannot roll up to itself"
      );
    }

    if (territory.parentId === ancestor.id) {
      throw new OperationNotAllowedError(
        "add_rollup_link",
        "Ancestor is already the primary parent"
      );
    }

    const primaryAncestors = await this.deps.closureRepository.findAncestorIds([
      input.territoryId,
    ]);
    if (primaryAncestors.includes(input.ancestorId)) {
      throw new OperationNotAllowedError(
        "add_rollup_link",
        "Ancestor is already in the primary hierarchy for this territory"
      );
    }

    const descendantIds = await this.deps.closureRepository.findDescendantIds(
      [input.territoryId],
      false
    );
    if (descendantIds.includes(input.ancestorId)) {
      throw new OperationNotAllowedError(
        "add_rollup_link",
        "Ancestor cannot be a descendant of the territory"
      );
    }

    const link = await this.deps.rollupRepository.create({
      territoryId: input.territoryId,
      ancestorId: input.ancestorId,
      relationshipType: input.relationshipType ?? "reporting",
      source: "manual",
    });

    return serializeRollupLink(link);
  }

  async removeRollupLink(territoryId: string, linkId: string) {
    const link = await this.deps.rollupRepository.findById(linkId);
    if (!link || link.territoryId !== territoryId) {
      throw new ResourceNotFoundError("TerritoryRollupLink", linkId);
    }

    await this.deps.rollupRepository.delete(linkId);
    return { success: true };
  }
}
