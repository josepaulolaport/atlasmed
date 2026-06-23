import type { TerritoryNodeType } from "@atlasmed/database";
import type { TerritoryRecord } from "../interfaces/territory.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";
import {
  validateRegionSlug,
  validateStateCode,
} from "./territory-code-generator.service";

const ALLOWED_CHILDREN: Record<TerritoryNodeType, TerritoryNodeType[]> = {
  root: ["region"],
  region: ["state", "intermediate"],
  state: ["intermediate", "patch"],
  intermediate: ["intermediate", "state", "patch"],
  patch: ["intermediate", "patch"],
};

export class TerritoryHierarchyValidator {
  validateCreate(params: {
    nodeType: TerritoryNodeType;
    parent: TerritoryRecord | null;
    regionSlug?: string | null;
    stateCode?: string | null;
    hasActiveRoot: boolean;
  }): void {
    const { nodeType, parent, regionSlug, stateCode, hasActiveRoot } = params;

    if (nodeType === "root") {
      if (parent) {
        throw new OperationNotAllowedError(
          "create_territory",
          "Root territory cannot have a parent"
        );
      }
      if (hasActiveRoot) {
        throw new OperationNotAllowedError(
          "create_territory",
          "An active root territory already exists"
        );
      }
      return;
    }

    if (!parent) {
      throw new OperationNotAllowedError(
        "create_territory",
        "Non-root territories require a parent"
      );
    }

    if (!parent.isActive) {
      throw new OperationNotAllowedError(
        "create_territory",
        "Parent territory must be active"
      );
    }

    const allowed = ALLOWED_CHILDREN[parent.nodeType];
    if (!allowed.includes(nodeType)) {
      throw new OperationNotAllowedError(
        "create_territory",
        `Cannot create ${nodeType} under ${parent.nodeType}`
      );
    }

    if (nodeType === "region") {
      if (!regionSlug || !validateRegionSlug(regionSlug)) {
        throw new OperationNotAllowedError(
          "create_territory",
          "Region territories require a valid regionSlug (2-10 uppercase alphanumeric)"
        );
      }
    }

    if (nodeType === "state") {
      if (!stateCode || !validateStateCode(stateCode)) {
        throw new OperationNotAllowedError(
          "create_territory",
          "State territories require a valid two-letter stateCode"
        );
      }
    }
  }

  validateReparent(params: {
    territory: TerritoryRecord;
    newParent: TerritoryRecord;
    descendantIds: string[];
  }): void {
    const { territory, newParent, descendantIds } = params;

    if (territory.id === newParent.id) {
      throw new OperationNotAllowedError(
        "reparent_territory",
        "Territory cannot be its own parent"
      );
    }

    if (descendantIds.includes(newParent.id)) {
      throw new OperationNotAllowedError(
        "reparent_territory",
        "Cannot reparent into a descendant (cycle detected)"
      );
    }

    const allowed = ALLOWED_CHILDREN[newParent.nodeType];
    if (!allowed.includes(territory.nodeType)) {
      throw new OperationNotAllowedError(
        "reparent_territory",
        `Cannot place ${territory.nodeType} under ${newParent.nodeType}`
      );
    }
  }

  isDynamicLeaf(activeChildCount: number): boolean {
    return activeChildCount === 0;
  }
}
