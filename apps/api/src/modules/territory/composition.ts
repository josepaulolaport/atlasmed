import { DrizzleTerritoryRepository } from "./infrastructure/repositories/drizzle/drizzle-territory.repository";
import { DrizzleTerritoryTypeRepository } from "./infrastructure/repositories/drizzle/drizzle-territory-type.repository";
import { DrizzleTerritorySpatialRepository } from "./infrastructure/repositories/drizzle/drizzle-territory-spatial.repository";
import { DrizzleTerritoryHierarchyPort } from "./infrastructure/ports/drizzle-territory-hierarchy.port";
import { DrizzleClinicMembershipWriter } from "./infrastructure/adapters/drizzle-facility-membership.writer";
import { DrizzleTerritoryBoundaryWriter } from "./infrastructure/adapters/drizzle-territory-boundary.writer";
import { TerritoryMembershipService } from "./application/services/territory-membership.service";
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

async function onTerritoryBoundaryChanged(territoryId: number): Promise<void> {
  // Spec 0006: clinic membership follows manager zones only. Patch boundary
  // changes do not rewrite manager_zone_id (impact/deassign flow handles owners).
  const territory = await territoryRepositories.territory.findById(territoryId);
  const type = territory?.territoryType
    ?? (territory
      ? await territoryRepositories.territoryType.findById(territory.territoryTypeId)
      : null);
  if (type && isManagerZoneType(type)) {
    await enqueueMembershipRecompute(territoryId);
  }
  await invalidateScopeForTerritories([territoryId]);
}

async function onManagerTerritoryChanged(managerTerritoryId: number): Promise<void> {
  await invalidateScopeForTerritories([managerTerritoryId]);
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
    if (job.facilityIds?.length) {
      for (const facilityId of job.facilityIds) {
        await territoryMembershipService.assignFacilityById(facilityId);
      }
      return;
    }

    if (job.territoryId) {
      await territoryMembershipService.recomputeForTerritoryBoundary(job.territoryId);
    } else {
      await territoryMembershipService.recomputeAll();
    }
  });
}

const territoryCrud = new TerritoryCrudUseCases({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  spatialRepository: territoryRepositories.spatial,
  containmentService: territoryContainmentService,
  membershipService: territoryMembershipService,
  onTerritoryDeactivated: enqueueMembershipRecompute,
  onBoundaryChanged: onTerritoryBoundaryChanged,
  onManagerTerritoryChanged: onManagerTerritoryChanged,
});

const territoryTypeCrud = new TerritoryTypeUseCases(territoryRepositories.territoryType);

const territoryBoundaryWriter = new DrizzleTerritoryBoundaryWriter();

function createBoundaryUseCases() {
  return new TerritoryBoundaryUseCases({
    territoryRepository: territoryRepositories.territory,
    territoryTypeRepository: territoryRepositories.territoryType,
    spatialRepository: territoryRepositories.spatial,
    containmentService: territoryContainmentService,
    boundaryWriter: territoryBoundaryWriter,
    onBoundaryChanged: onTerritoryBoundaryChanged,
    onManagerTerritoryChanged: onManagerTerritoryChanged,
  });
}

export { territoryMembershipService, enqueueClinicMembershipUpdate };

export const territoryAssignmentPolicy = new TerritoryAssignmentPolicyService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
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
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
      onFacilityChanged: upsertFacilitySearchDocument,
    }),
  listUnassignedFacilities: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
      onFacilityChanged: upsertFacilitySearchDocument,
    }),
  adminOverrideClinicTerritory: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
      onFacilityChanged: upsertFacilitySearchDocument,
    }),
  unlockClinicGeo: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
      onFacilityChanged: upsertFacilitySearchDocument,
    }),
};
