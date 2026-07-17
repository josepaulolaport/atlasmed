import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryApprovalType } from "@atlasmed/database";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";

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

export async function assertManagerTerritoryApprovalRequest(input: {
  scope: ScopeContext;
  territoryRepository: TerritoryRepository;
  type: TerritoryApprovalType;
  targetTerritoryId?: string | null;
  facilityId?: string | null;
  toTerritoryId?: string | null;
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

    case "clinic_territory_change": {
      if (!input.facilityId || !input.toTerritoryId) {
        throw new OperationNotAllowedError(
          "clinic_territory_change",
          "Facility and target territory are required"
        );
      }

      if (
        input.scope.facilityIds.length > 0
          ? !input.scope.facilityIds.includes(input.facilityId)
          : true
      ) {
        throw new OperationNotAllowedError(
          "clinic_territory_change",
          "Facility is outside your scope"
        );
      }

      assertTerritorialJurisdiction(
        input.scope,
        input.toTerritoryId,
        "clinic_territory_change"
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
