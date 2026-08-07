import type { ScopeContext } from "@atlasmed/access";
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
