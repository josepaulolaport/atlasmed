import { logger } from "../../../../infrastructure/logging/logger";

export interface StagedTerritoryCleanupPort {
  deleteTerritory(id: number): Promise<unknown>;
}

/**
 * Compensating cleanup for territories created while staging an invitation.
 *
 * `newPatch` creates a real territory before the invitation can be validated —
 * `validateEmptyRepPatch` looks the patch up by id, and the drawn boundary's
 * containment (`managerTerritoryId`) is only known post-creation. So creation
 * cannot simply be moved after validation; a rejected invite would otherwise
 * leave the patch behind forever.
 *
 * BEST-EFFORT CONTAINMENT, NOT A TRANSACTION. A process crash between creation
 * and this call still orphans the territory. The real fix is to make
 * `TerritoryCrudUseCases.createTerritory` transactional (it currently fans out
 * across territory/spatial/containment repositories plus `onBoundaryChanged` /
 * `onManagerTerritoryChanged` side-effect hooks, so that is a territory-module
 * change, not an invite-flow one). Do not assume this is atomic.
 *
 * Note `deleteTerritory` is a soft delete — it deactivates the row (the
 * project's only territory deletion semantics). The orphan stops being live and
 * selectable; the row itself remains.
 *
 * Never rethrows: the caller must surface the error that triggered the rollback,
 * not a cleanup failure.
 */
export async function cleanupStagedTerritories(
  territoryCrud: StagedTerritoryCleanupPort | undefined,
  territoryIds: number[],
  cause: unknown,
): Promise<void> {
  if (!territoryCrud || territoryIds.length === 0) {
    return;
  }

  const causeMessage = cause instanceof Error ? cause.message : String(cause);

  for (const territoryId of territoryIds) {
    try {
      await territoryCrud.deleteTerritory(territoryId);
      logger.warn("invite.staged_territory_cleaned_up", {
        territoryId,
        cause: causeMessage,
      });
    } catch (cleanupError) {
      // Swallowed on purpose — the original failure is the one that matters.
      // An operator seeing a live orphan can tell from this line that cleanup
      // ran and failed, rather than never having run.
      logger.error("invite.staged_territory_cleanup_failed", {
        territoryId,
        cause: causeMessage,
        cleanupError:
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
      });
    }
  }
}
