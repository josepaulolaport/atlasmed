import { PrismaTerritoryRepository } from "./infrastructure/repositories/prisma/prisma-territory.repository";
import { PrismaTerritoryTypeRepository } from "./infrastructure/repositories/prisma/prisma-territory-type.repository";
import { PrismaTerritoryClosureRepository } from "./infrastructure/repositories/prisma/prisma-territory-closure.repository";
import { PrismaTerritorySpatialRepository } from "./infrastructure/repositories/prisma/prisma-territory-spatial.repository";
import { PrismaTerritoryApprovalRepository } from "./infrastructure/repositories/prisma/prisma-territory-approval.repository";
import { PrismaTerritoryRollupRepository } from "./infrastructure/repositories/prisma/prisma-territory-rollup.repository";
import { PrismaTerritoryHierarchyPort } from "./infrastructure/ports/prisma-territory-hierarchy.port";
import { PrismaClinicMembershipWriter } from "./infrastructure/adapters/prisma-facility-membership.writer";
import { TerritoryClosureService } from "./application/services/territory-closure.service";
import { TerritoryMembershipService } from "./application/services/territory-membership.service";
import { TerritoryAssignmentPolicyService } from "./application/services/territory-assignment-policy.service";
import { TerritoryCrudUseCases } from "./application/use-cases/territory-crud.use-cases";
import { TerritoryTypeUseCases } from "./application/use-cases/territory-type.use-cases";
import { TerritoryBoundaryUseCases } from "./application/use-cases/territory-boundary.use-cases";
import { TerritoryMembershipUseCases } from "./application/use-cases/territory-membership.use-cases";
import { TerritoryApprovalUseCases } from "./application/use-cases/territory-approval.use-cases";
import { TerritoryRollupUseCases } from "./application/use-cases/territory-rollup.use-cases";
import { TerritoryGeoParentService } from "./application/services/territory-geo-parent.service";
import { PrismaTerritoryGeoMembershipRepository } from "./infrastructure/repositories/prisma/prisma-territory-geo-membership.repository";
import { TerritoryGeoMembershipService } from "./application/services/territory-geo-membership.service";
import { TerritoryGeoMembershipUseCases } from "./application/use-cases/territory-geo-membership.use-cases";
import { TerritoryCoverageUseCases } from "./application/use-cases/territory-coverage.use-cases";
import { territoryMembershipQueue } from "../../infrastructure/jobs/territory-membership.queue";
import { scopeCacheService } from "../access/infrastructure/cache/scope-cache.service";
import { auditLogAdapter } from "../access/infrastructure/adapters/audit-log.adapter";

export const territoryRepositories = {
  territory: new PrismaTerritoryRepository(),
  territoryType: new PrismaTerritoryTypeRepository(),
  closure: new PrismaTerritoryClosureRepository(),
  spatial: new PrismaTerritorySpatialRepository(),
  approval: new PrismaTerritoryApprovalRepository(),
  rollup: new PrismaTerritoryRollupRepository(),
  geoMembership: new PrismaTerritoryGeoMembershipRepository(),
};

export const facilityMembershipWriter = new PrismaClinicMembershipWriter();

export const territoryHierarchyPort = new PrismaTerritoryHierarchyPort(
  territoryRepositories.closure,
  territoryRepositories.geoMembership
);

const territoryClosureService = new TerritoryClosureService({
  territoryRepository: territoryRepositories.territory,
  closureRepository: territoryRepositories.closure,
});

const territoryMembershipService = new TerritoryMembershipService({
  spatialRepository: territoryRepositories.spatial,
  territoryRepository: territoryRepositories.territory,
  clinicWriter: facilityMembershipWriter,
});

async function enqueueMembershipRecompute(territoryId?: string): Promise<void> {
  await territoryMembershipQueue.enqueue({
    territoryId,
    reason: territoryId ? "boundary_change" : "manual_recompute",
  });
}

async function onTerritoryBoundaryChanged(territoryId: string): Promise<void> {
  await enqueueMembershipRecompute(territoryId);
  await invalidateScopeForTerritories([territoryId]);
}

async function enqueueClinicMembershipUpdate(facilityId: string): Promise<void> {
  await territoryMembershipQueue.enqueue({
    facilityIds: [facilityId],
    reason: "clinic_update",
  });
}

async function invalidateScopeForTerritories(territoryIds: string[]): Promise<void> {
  const userIds =
    await territoryHierarchyPort.findUsersAssignedToTerritoryAncestors(territoryIds);
  await scopeCacheService.invalidateMany(userIds);
}

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

const territoryGeoMembershipService = new TerritoryGeoMembershipService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  geoMembershipRepository: territoryRepositories.geoMembership,
});

const territoryGeoParentService = new TerritoryGeoParentService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  closureRepository: territoryRepositories.closure,
  spatialRepository: territoryRepositories.spatial,
  rollupRepository: territoryRepositories.rollup,
  closureService: territoryClosureService,
  onScopeInvalidated: invalidateScopeForTerritories,
});

const territoryCrud = new TerritoryCrudUseCases({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  closureRepository: territoryRepositories.closure,
  spatialRepository: territoryRepositories.spatial,
  geoParentService: territoryGeoParentService,
  geoMembershipService: territoryGeoMembershipService,
  closureService: territoryClosureService,
  onTerritoryDeactivated: enqueueMembershipRecompute,
  onBoundaryChanged: onTerritoryBoundaryChanged,
});

const territoryTypeCrud = new TerritoryTypeUseCases(territoryRepositories.territoryType);

function createBoundaryUseCases() {
  return new TerritoryBoundaryUseCases({
    territoryRepository: territoryRepositories.territory,
    territoryTypeRepository: territoryRepositories.territoryType,
    spatialRepository: territoryRepositories.spatial,
    closureRepository: territoryRepositories.closure,
    geoParentService: territoryGeoParentService,
    geoMembershipService: territoryGeoMembershipService,
    onBoundaryChanged: onTerritoryBoundaryChanged,
  });
}

export { territoryMembershipService, enqueueClinicMembershipUpdate };

export const territoryAssignmentPolicy = new TerritoryAssignmentPolicyService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  closureRepository: territoryRepositories.closure,
});

export const territoryUseCases = {
  listTerritories: () => territoryCrud,
  createTerritory: () => territoryCrud,
  getTerritory: () => territoryCrud,
  updateTerritory: () => territoryCrud,
  deactivateTerritory: () => territoryCrud,
  getDescendants: () => territoryCrud,
  listAmbiguousParentTerritories: () => territoryCrud,
  listTerritoryTypes: () => territoryTypeCrud,
  createTerritoryType: () => territoryTypeCrud,
  getTerritoryType: () => territoryTypeCrud,
  updateTerritoryType: () => territoryTypeCrud,
  getBoundary: () => createBoundaryUseCases(),
  saveBoundary: () => createBoundaryUseCases(),
  deleteBoundary: () => createBoundaryUseCases(),
  recomputeMembership: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
    }),
  listUnassignedFacilities: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
    }),
  adminOverrideClinicTerritory: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
    }),
  unlockClinicGeo: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter,
    }),
  submitApproval: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      territoryCrud,
      clinicWriter: facilityMembershipWriter,
      invalidateScopeForTerritories,
      enqueueMembershipRecompute,
      auditLog: auditLogAdapter,
    }),
  listApprovalRequests: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      territoryCrud,
      clinicWriter: facilityMembershipWriter,
    }),
  approveRequest: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      territoryCrud,
      clinicWriter: facilityMembershipWriter,
      invalidateScopeForTerritories,
      enqueueMembershipRecompute,
      auditLog: auditLogAdapter,
    }),
  rejectRequest: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      territoryCrud,
      clinicWriter: facilityMembershipWriter,
    }),
  listRollupLinks: () =>
    new TerritoryRollupUseCases({
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      rollupRepository: territoryRepositories.rollup,
    }),
  addRollupLink: () =>
    new TerritoryRollupUseCases({
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      rollupRepository: territoryRepositories.rollup,
    }),
  removeRollupLink: () =>
    new TerritoryRollupUseCases({
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      rollupRepository: territoryRepositories.rollup,
    }),
  listOperationalMembers: () =>
    new TerritoryGeoMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      geoMembershipRepository: territoryRepositories.geoMembership,
      spatialRepository: territoryRepositories.spatial,
      closureRepository: territoryRepositories.closure,
    }),
  listReferenceMemberships: () =>
    new TerritoryGeoMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      geoMembershipRepository: territoryRepositories.geoMembership,
      spatialRepository: territoryRepositories.spatial,
      closureRepository: territoryRepositories.closure,
    }),
  getClippedBoundary: () =>
    new TerritoryGeoMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      geoMembershipRepository: territoryRepositories.geoMembership,
      spatialRepository: territoryRepositories.spatial,
      closureRepository: territoryRepositories.closure,
    }),
  getReferenceCoverage: () =>
    new TerritoryCoverageUseCases({
      territoryRepository: territoryRepositories.territory,
      territoryTypeRepository: territoryRepositories.territoryType,
      geoMembershipRepository: territoryRepositories.geoMembership,
      spatialRepository: territoryRepositories.spatial,
      closureRepository: territoryRepositories.closure,
    }),
};
