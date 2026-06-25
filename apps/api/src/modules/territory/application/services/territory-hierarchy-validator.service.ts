import type { TerritoryTypeRecord } from "../interfaces/territory-type.repository.interface";
import type { TerritoryRecord } from "../interfaces/territory.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";
import { validateCountryCode } from "../constants/territory-geo.constants";
import { validateTerritorySlug } from "../constants/territory-slug.constants";

export class TerritoryHierarchyValidator {
  validateCreate(params: {
    type: TerritoryTypeRecord;
    slug: string;
    countryCode: string;
    parent: TerritoryRecord | null;
    parentId?: string | null;
    hasActiveCountryForCode: boolean;
  }): void {
    const { type, slug, countryCode, parent, parentId, hasActiveCountryForCode } = params;

    if (!validateTerritorySlug(slug)) {
      throw new OperationNotAllowedError(
        "create_territory",
        "slug must be 3-60 lowercase alphanumeric characters with optional hyphens"
      );
    }

    if (!validateCountryCode(countryCode)) {
      throw new OperationNotAllowedError(
        "create_territory",
        "countryCode must be a valid two-letter ISO code"
      );
    }

    if (type.isCountryLevel) {
      if (parentId || parent) {
        throw new OperationNotAllowedError(
          "create_territory",
          "Country-level territories cannot have a parent"
        );
      }
      if (hasActiveCountryForCode) {
        throw new OperationNotAllowedError(
          "create_territory",
          `An active country already exists for ${countryCode}`
        );
      }
      return;
    }

    if (parent) {
      if (!parent.isActive) {
        throw new OperationNotAllowedError(
          "create_territory",
          "Parent territory must be active"
        );
      }
      if (parent.countryCode && parent.countryCode !== countryCode) {
        throw new OperationNotAllowedError(
          "create_territory",
          "Parent must belong to the same country"
        );
      }
    }
  }

  validateReparent(params: {
    territory: TerritoryRecord;
    territoryType: TerritoryTypeRecord;
    newParent: TerritoryRecord;
    descendantIds: string[];
  }): void {
    const { territory, territoryType, newParent, descendantIds } = params;

    if (territoryType.isCountryLevel) {
      throw new OperationNotAllowedError(
        "reparent_territory",
        "Country-level territories cannot be reparented"
      );
    }

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

    if (
      territory.countryCode &&
      newParent.countryCode &&
      territory.countryCode !== newParent.countryCode
    ) {
      throw new OperationNotAllowedError(
        "reparent_territory",
        "Cannot reparent across countries"
      );
    }
  }

  isDynamicLeaf(activeChildCount: number): boolean {
    return activeChildCount === 0;
  }

  canHaveBoundary(type: TerritoryTypeRecord): boolean {
    return type.canHaveBoundary;
  }
}
