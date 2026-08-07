import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryApprovalType } from "@atlasmed/database";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";

/** Operational jurisdiction — territories the manager may mutate. */
export function isInTerritorialJurisdiction(
  scope: Pick<ScopeContext, "effectiveTerritoryIds">,
  territoryId: number
): boolean {
  return scope.effectiveTerritoryIds.includes(territoryId);
}

export function assertTerritorialJurisdiction(
  scope: Pick<ScopeContext, "isGlobal" | "effectiveTerritoryIds">,
  territoryId: number,
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

export async function assertManagerTerritoryApprovalRequest(input: {
  scope: ScopeContext;
  territoryRepository: TerritoryRepository;
  type: TerritoryApprovalType;
  targetTerritoryId?: number | null;
  facilityId?: number | null;
  toTerritoryId?: number | null;
  entityPayload?: Record<string, unknown>;
}): Promise<void> {
  if (input.scope.isGlobal) {
    return;
  }

  switch (input.type) {
    case "deactivate_territory": {
      if (!input.targetTerritoryId) {
        throw new OperationNotAllowedError(
          "deactivate_territory",
          "Target territory is required"
        );
      }

      assertTerritorialJurisdiction(
        input.scope,
        input.targetTerritoryId,
        "deactivate_territory"
      );
      return;
    }

    default:
      throw new OperationNotAllowedError(
        "submit_approval",
        "Unsupported territory approval type"
      );
  }
}
