import { DrizzleTerritoryRepository } from "./infrastructure/repositories/drizzle/drizzle-territory.repository";
import { DrizzleTerritoryTypeRepository } from "./infrastructure/repositories/drizzle/drizzle-territory-type.repository";
import { DrizzleTerritorySpatialRepository } from "./infrastructure/repositories/drizzle/drizzle-territory-spatial.repository";
import { DrizzleTerritoryHierarchyPort } from "./infrastructure/ports/drizzle-territory-hierarchy.port";
import { DrizzleClinicMembershipWriter } from "./infrastructure/adapters/drizzle-facility-membership.writer";
import { DrizzleTerritoryBoundaryWriter } from "./infrastructure/adapters/drizzle-territory-boundary.writer";
import { DrizzleTerritoryTransactionPort } from "./infrastructure/ports/drizzle-territory-transaction.port";
import { TerritoryMembershipService } from "./application/services/territory-membership.service";
import { DrizzleScopeRepository } from "../access/infrastructure/repositories/drizzle/drizzle-scope.repository";
import { TerritoryAssignmentPolicyService } from "./application/services/territory-assignment-policy.service";
import { TerritoryContainmentService } from "./application/services/territory-containment.service";
import { TerritoryCrudUseCases } from "./application/use-cases/territory-crud.use-cases";
import { TerritoryTypeUseCases } from "./application/use-cases/territory-type.use-cases";
import { TerritoryBoundaryUseCases } from "./application/use-cases/territory-boundary.use-cases";
import { TerritoryMembershipUseCases } from "./application/use-cases/territory-membership.use-cases";
import { territoryMembershipQueue } from "../../infrastructure/jobs/territory-membership.queue";
import { upsertFacilitySearchDocument } from "../../infrastructure/search/facility-search-index.service";
import { scopeCacheService } from "../access/infrastructure/cache/scope-cache.service";
import { isManagerZoneType } from "./application/constants/territory-roles.constants";
import { logger } from "../../infrastructure/logging/logger";
import { metricsService } from "../../infrastructure/monitoring/metrics.service";

export const territoryRepositories = {
  territory: new DrizzleTerritoryRepository(),
  territoryType: new DrizzleTerritoryTypeRepository(),
  spatial: new DrizzleTerritorySpatialRepository(),
};

export const facilityMembershipWriter = new DrizzleClinicMembershipWriter();

export const territoryHierarchyPort = new DrizzleTerritoryHierarchyPort(
  territoryRepositories.territory
);

const territoryMembershipService = new TerritoryMembershipService({
  spatialRepository: territoryRepositories.spatial,
  territoryRepository: territoryRepositories.territory,
  clinicWriter: facilityMembershipWriter,
  onClinicMembershipChanged: async (facilityId) => {
    await upsertFacilitySearchDocument(facilityId);
  },
  recordAmbiguousMatch: (source, count) =>
    metricsService.recordAmbiguousManagerZone(source, count),
  logAmbiguousMatch: (match) => {
    logger.warn("Clinic covered by more than one manager zone; membership cleared", {
      facilityId: match.facilityId,
      verticalId: match.verticalId,
      zoneIds: match.zoneIds.join(","),
    });
  },
});

const territoryContainmentService = new TerritoryContainmentService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  spatialRepository: territoryRepositories.spatial,
});

async function enqueueMembershipRecompute(territoryId?: number): Promise<void> {
  await territoryMembershipQueue.enqueue({
    territoryId,
    reason: territoryId ? "boundary_change" : "manual_recompute",
  });
}

/**
 * Everything here runs *after* the boundary transaction committed, so none of it
 * may turn a successful save into a reported failure.
 *
 * Spec 0009 R6: previously one unguarded await did the work, and a Redis outage
 * threw out of a save that had already committed — the caller saw an error for
 * work that succeeded, *and* the scope cache stayed stale because the throw
 * skipped the invalidation below it. Failures are logged instead: the boundary
 * is committed and the caller's save genuinely did succeed.
 */
async function afterBoundaryCommitted(
  territoryId: number,
  options: { enqueueRecompute: boolean }
): Promise<void> {
  if (options.enqueueRecompute) {
    try {
      await enqueueMembershipRecompute(territoryId);
    } catch (error) {
      logger.error("Failed to enqueue territory membership recompute", {
        territoryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await invalidateScopeForTerritories([territoryId]);
  } catch (error) {
    logger.error("Failed to invalidate territory scope cache", {
      territoryId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The CRUD path (creating or deactivating a territory that carries a boundary)
 * still needs the recompute queued: unlike `saveBoundary` it does not run inside
 * a transaction that could do the work itself.
 *
 * Spec 0006: clinic membership follows manager zones only. Patch boundary
 * changes do not rewrite manager_zone_id (impact/deassign flow handles owners).
 */
async function onTerritoryBoundaryChanged(territoryId: number): Promise<void> {
  const territory = await territoryRepositories.territory.findById(territoryId);
  const type = territory?.territoryType
    ?? (territory
      ? await territoryRepositories.territoryType.findById(territory.territoryTypeId)
      : null);

  await afterBoundaryCommitted(territoryId, {
    enqueueRecompute: Boolean(type && isManagerZoneType(type)),
  });
}

/**
 * Spec 0009 R6: `saveBoundary` recomputes membership inside its own transaction,
 * so this path must not queue it a second time.
 */
async function onSavedBoundaryCommitted(territoryId: number): Promise<void> {
  await afterBoundaryCommitted(territoryId, { enqueueRecompute: false });
}

async function onManagerTerritoryChanged(managerTerritoryId: number): Promise<void> {
  await afterBoundaryCommitted(managerTerritoryId, { enqueueRecompute: false });
}

async function enqueueClinicMembershipUpdate(facilityId: number): Promise<void> {
  await territoryMembershipQueue.enqueue({
    facilityIds: [facilityId],
    reason: "clinic_update",
  });
}

async function invalidateScopeForTerritories(territoryIds: number[]): Promise<void> {
  const userIds =
    await territoryHierarchyPort.findUsersAssignedToRelatedTerritories(territoryIds);
  await scopeCacheService.invalidateMany(userIds);
}

export function registerTerritoryMembershipWorker(): void {
  territoryMembershipQueue.registerHandler(async (job) => {
    // Membership is already written; only the search projection is behind.
    if (job.reason === "search_sync") {
      for (const facilityId of job.facilityIds ?? []) {
        await upsertFacilitySearchDocument(facilityId);
      }
      return;
    }

    if (job.facilityIds?.length) {
      for (const facilityId of job.facilityIds) {
        await territoryMembershipService.assignFacilityById(facilityId);
      }
      return;
    }

    if (job.territoryId) {
      const result = await territoryMembershipService.recomputeForTerritoryBoundary(
        job.territoryId
      );
      await enqueueSearchSyncForFacilities(result.changed.map((c) => c.facilityId));
    } else {
      await territoryMembershipService.recomputeAll();
    }
  });
}

/**
 * Catches the search index up on clinics whose manager zone just changed.
 *
 * Meili's `territoryIds` is a projection of membership, and nothing else updates
 * it after a boundary change: `fullSearchSyncWorkflow` is started only by
 * `POST /sync`, on no schedule, so without this the index stays wrong until an
 * operator happens to trigger a full rebuild. Queued rather than awaited — Meili
 * is an external service and must not sit on the request path, let alone inside
 * the boundary transaction.
 */
async function enqueueSearchSyncForFacilities(facilityIds: number[]): Promise<void> {
  const unique = [...new Set(facilityIds)];
  if (unique.length === 0) {
    return;
  }

  try {
    await territoryMembershipQueue.enqueue({ facilityIds: unique, reason: "search_sync" });
  } catch (error) {
    logger.error("Failed to enqueue search sync after membership recompute", {
      facilityCount: unique.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const territoryTransactionPort = new DrizzleTerritoryTransactionPort();

const territoryCrud = new TerritoryCrudUseCases({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  spatialRepository: territoryRepositories.spatial,
  containmentService: territoryContainmentService,
  // Spec 0009 R1: creation is now atomic too — the row and its geometry commit
  // together, so a rejected boundary leaves no orphan territory.
  transactionPort: territoryTransactionPort,
  buildContainmentService: (repos) => new TerritoryContainmentService(repos),
  membershipService: territoryMembershipService,
  onTerritoryDeactivated: enqueueMembershipRecompute,
  onBoundaryChanged: onTerritoryBoundaryChanged,
  onManagerTerritoryChanged: onManagerTerritoryChanged,
});

const territoryTypeCrud = new TerritoryTypeUseCases(territoryRepositories.territoryType);

function createBoundaryUseCases() {
  return new TerritoryBoundaryUseCases({
    territoryRepository: territoryRepositories.territory,
    territoryTypeRepository: territoryRepositories.territoryType,
    spatialRepository: territoryRepositories.spatial,
    containmentService: territoryContainmentService,
    transactionPort: territoryTransactionPort,
    // Spec 0009 R1: the save path re-binds containment to the transaction's own
    // repositories, so it checks the snapshot it is about to mutate.
    buildContainmentService: (repos) => new TerritoryContainmentService(repos),
    onBoundaryChanged: onSavedBoundaryCommitted,
    onManagerTerritoryChanged: onManagerTerritoryChanged,
    onMembershipRecomputed: enqueueSearchSyncForFacilities,
    onAmbiguousManagerZones: (matches) => {
      metricsService.recordAmbiguousManagerZone("boundary_save", matches.length);
      for (const match of matches) {
        // Both zone ids in the line: the operator's next question is "which two".
        logger.warn("Clinic covered by more than one manager zone; membership cleared", {
          facilityId: match.facilityId,
          facilityVerticalProfileId: match.facilityVerticalProfileId,
          verticalId: match.verticalId,
          zoneIds: match.zoneIds.join(","),
        });
      }
    },
  });
}

export { territoryMembershipService, enqueueClinicMembershipUpdate };

export const territoryAssignmentPolicy = new TerritoryAssignmentPolicyService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  // Invariant I6 needs the target's asserted vertical membership. Constructed
  // directly rather than imported from the access module's composition: that
  // module imports this one, and going the other way closes the cycle.
  verticalMembership: new DrizzleScopeRepository(),
});

export const territoryUseCases = {
  listTerritories: () => territoryCrud,
  createTerritory: () => territoryCrud,
  getTerritory: () => territoryCrud,
  updateTerritory: () => territoryCrud,
  deactivateTerritory: () => territoryCrud,
  deleteTerritory: () => territoryCrud,
  listTerritoryTypes: () => territoryTypeCrud,
  createTerritoryType: () => territoryTypeCrud,
  getTerritoryType: () => territoryTypeCrud,
  updateTerritoryType: () => territoryTypeCrud,
  getBoundary: () => createBoundaryUseCases(),
  previewBoundaryImpact: () => createBoundaryUseCases(),
  saveBoundary: () => createBoundaryUseCases(),
  deleteBoundary: () => createBoundaryUseCases(),
  recomputeMembership: () =>
    new TerritoryMembershipUseCases({
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
      onFacilityChanged: upsertFacilitySearchDocument,
    }),
  listUnassignedFacilities: () =>
    new TerritoryMembershipUseCases({
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
      onFacilityChanged: upsertFacilitySearchDocument,
    }),
};
