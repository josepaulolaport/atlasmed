import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryApprovalType } from "@atlasmed/database";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";

export function isTerritoryLeaf(activeChildCount: number): boolean {
  return activeChildCount === 0;
}

/** Operational jurisdiction — territories the manager may mutate. */
export function isInTerritorialJurisdiction(
  scope: Pick<ScopeContext, "effectiveTerritoryIds">,
  territoryId: string
): boolean {
  return scope.effectiveTerritoryIds.includes(territoryId);
}

export function assertTerritorialJurisdiction(
  scope: Pick<ScopeContext, "isGlobal" | "effectiveTerritoryIds">,
  territoryId: string,
  operation: string
): void {
  if (scope.isGlobal) {
    return;
  }

  if (!isInTerritorialJurisdiction(scope, territoryId)) {
    throw new OperationNotAllowedError(
      operation,
      "Territory is outside your territorial jurisdiction"
    );
  }
}

/**
 * Readable territories = jurisdiction ∪ ancestors (for scoped tree navigation).
 * Returns null when unscoped (global).
 */
export async function resolveReadableTerritoryIds(
  scope: Pick<ScopeContext, "isGlobal" | "effectiveTerritoryIds">,
  closureRepository: TerritoryClosureRepository
): Promise<Set<string> | null> {
  if (scope.isGlobal) {
    return null;
  }

  if (scope.effectiveTerritoryIds.length === 0) {
    return new Set();
  }

  const ancestors = await closureRepository.findAncestorIds(
    scope.effectiveTerritoryIds
  );

  return new Set([...scope.effectiveTerritoryIds, ...ancestors]);
}

export function assertTerritoryReadable(
  readableTerritoryIds: Set<string> | null,
  territoryId: string
): void {
  if (readableTerritoryIds === null) {
    return;
  }

  if (!readableTerritoryIds.has(territoryId)) {
    throw new OperationNotAllowedError(
      "read_territory",
      "Territory is outside your readable scope"
    );
  }
}

export async function assertLeafTerritoryInJurisdiction(
  input: {
    scope: Pick<ScopeContext, "isGlobal" | "effectiveTerritoryIds">;
    territoryRepository: TerritoryRepository;
    territoryId: string;
    operation: string;
  }
): Promise<void> {
  if (input.scope.isGlobal) {
    return;
  }

  assertTerritorialJurisdiction(
    input.scope,
    input.territoryId,
    input.operation
  );

  const territory = await input.territoryRepository.findById(input.territoryId);
  if (!territory) {
    throw new ResourceNotFoundError("Territory", input.territoryId);
  }

  const activeChildCount = await input.territoryRepository.countActiveChildren(
    input.territoryId
  );

  if (!isTerritoryLeaf(activeChildCount)) {
    throw new OperationNotAllowedError(
      input.operation,
      "Only leaf territories in your jurisdiction can be modified by managers"
    );
  }
}

export async function assertManagerTerritoryApprovalRequest(input: {
  scope: ScopeContext;
  territoryRepository: TerritoryRepository;
  closureRepository: TerritoryClosureRepository;
  type: TerritoryApprovalType;
  targetTerritoryId?: string | null;
  facilityId?: string | null;
  toTerritoryId?: string | null;
  entityPayload?: Record<string, unknown>;
}): Promise<void> {
  if (input.scope.isGlobal) {
    return;
  }

  const payload = input.entityPayload ?? {};

  switch (input.type) {
    case "create_territory": {
      const parentId =
        (typeof payload.parentId === "string" ? payload.parentId : undefined) ??
        undefined;

      if (!parentId) {
        throw new OperationNotAllowedError(
          "create_territory",
          "Managers must create territories under a parent in their readable scope"
        );
      }

      const readableIds = await resolveReadableTerritoryIds(
        input.scope,
        input.closureRepository
      );
      assertTerritoryReadable(readableIds, parentId);
      return;
    }

    case "reparent_territory": {
      if (!input.targetTerritoryId) {
        throw new OperationNotAllowedError(
          "reparent_territory",
          "Target territory is required"
        );
      }

      await assertLeafTerritoryInJurisdiction({
        scope: input.scope,
        territoryRepository: input.territoryRepository,
        territoryId: input.targetTerritoryId,
        operation: "reparent_territory",
      });

      const newParentId = payload.parentId;
      if (typeof newParentId === "string" && newParentId.length > 0) {
        assertTerritorialJurisdiction(
          input.scope,
          newParentId,
          "reparent_territory"
        );
      }

      return;
    }

    case "deactivate_territory": {
      if (!input.targetTerritoryId) {
        throw new OperationNotAllowedError(
          "deactivate_territory",
          "Target territory is required"
        );
      }

      await assertLeafTerritoryInJurisdiction({
        scope: input.scope,
        territoryRepository: input.territoryRepository,
        territoryId: input.targetTerritoryId,
        operation: "deactivate_territory",
      });
      return;
    }

    case "facility_territory_change": {
      if (!input.facilityId || !input.toTerritoryId) {
        throw new OperationNotAllowedError(
          "facility_territory_change",
          "Facility and target territory are required"
        );
      }

      if (
        input.scope.facilityIds.length > 0
          ? !input.scope.facilityIds.includes(input.facilityId)
          : true
      ) {
        throw new OperationNotAllowedError(
          "facility_territory_change",
          "Facility is outside your scope"
        );
      }

      await assertLeafTerritoryInJurisdiction({
        scope: input.scope,
        territoryRepository: input.territoryRepository,
        territoryId: input.toTerritoryId,
        operation: "facility_territory_change",
      });
      return;
    }

    default:
      throw new OperationNotAllowedError(
        "submit_approval",
        "Unsupported territory approval type"
      );
  }
}
