import { PrismaTerritoryRepository } from "./infrastructure/repositories/prisma/prisma-territory.repository";
import { PrismaTerritoryClosureRepository } from "./infrastructure/repositories/prisma/prisma-territory-closure.repository";
import { PrismaTerritorySpatialRepository } from "./infrastructure/repositories/prisma/prisma-territory-spatial.repository";
import { PrismaTerritoryApprovalRepository } from "./infrastructure/repositories/prisma/prisma-territory-approval.repository";
import { PrismaTerritoryHierarchyPort } from "./infrastructure/ports/prisma-territory-hierarchy.port";
import { PrismaClinicMembershipWriter } from "./infrastructure/adapters/prisma-clinic-membership.writer";
import { TerritoryClosureService } from "./application/services/territory-closure.service";
import { TerritoryMembershipService } from "./application/services/territory-membership.service";
import { TerritoryAssignmentPolicyService } from "./application/services/territory-assignment-policy.service";
import { TerritoryCrudUseCases } from "./application/use-cases/territory-crud.use-cases";
import { TerritoryBoundaryUseCases } from "./application/use-cases/territory-boundary.use-cases";
import { TerritoryMembershipUseCases } from "./application/use-cases/territory-membership.use-cases";
import { TerritoryApprovalUseCases } from "./application/use-cases/territory-approval.use-cases";
import { territoryMembershipQueue } from "../../infrastructure/jobs/territory-membership.queue";
import { scopeCacheService } from "../access/infrastructure/cache/scope-cache.service";
import { auditLogAdapter } from "../access/infrastructure/adapters/audit-log.adapter";

export const territoryRepositories = {
  territory: new PrismaTerritoryRepository(),
  closure: new PrismaTerritoryClosureRepository(),
  spatial: new PrismaTerritorySpatialRepository(),
  approval: new PrismaTerritoryApprovalRepository(),
};

export const clinicMembershipWriter = new PrismaClinicMembershipWriter();

export const territoryHierarchyPort = new PrismaTerritoryHierarchyPort(
  territoryRepositories.closure
);

const territoryClosureService = new TerritoryClosureService({
  territoryRepository: territoryRepositories.territory,
  closureRepository: territoryRepositories.closure,
});

const territoryMembershipService = new TerritoryMembershipService({
  spatialRepository: territoryRepositories.spatial,
  territoryRepository: territoryRepositories.territory,
  clinicWriter: clinicMembershipWriter,
});

async function enqueueMembershipRecompute(territoryId?: string): Promise<void> {
  await territoryMembershipQueue.enqueue({
    territoryId,
    reason: territoryId ? "boundary_change" : "manual_recompute",
  });
}

async function invalidateScopeForTerritories(territoryIds: string[]): Promise<void> {
  const userIds =
    await territoryHierarchyPort.findUsersAssignedToTerritoryAncestors(territoryIds);
  await scopeCacheService.invalidateMany(userIds);
}

territoryMembershipQueue.registerHandler(async (job) => {
  if (job.territoryId) {
    await territoryMembershipService.recomputeForTerritoryBoundary(job.territoryId);
  } else {
    await territoryMembershipService.recomputeAll();
  }
});

const territoryCrud = new TerritoryCrudUseCases({
  territoryRepository: territoryRepositories.territory,
  closureRepository: territoryRepositories.closure,
  spatialRepository: territoryRepositories.spatial,
  closureService: territoryClosureService,
});

export const territoryAssignmentPolicy = new TerritoryAssignmentPolicyService({
  territoryRepository: territoryRepositories.territory,
  closureRepository: territoryRepositories.closure,
});

export const territoryUseCases = {
  listTerritories: () => territoryCrud,
  createTerritory: () => territoryCrud,
  getTerritory: () => territoryCrud,
  updateTerritory: () => territoryCrud,
  deactivateTerritory: () => territoryCrud,
  getDescendants: () => territoryCrud,
  getBoundary: () =>
    new TerritoryBoundaryUseCases({
      territoryRepository: territoryRepositories.territory,
      spatialRepository: territoryRepositories.spatial,
      onBoundaryChanged: enqueueMembershipRecompute,
    }),
  saveBoundary: () =>
    new TerritoryBoundaryUseCases({
      territoryRepository: territoryRepositories.territory,
      spatialRepository: territoryRepositories.spatial,
      onBoundaryChanged: enqueueMembershipRecompute,
    }),
  deleteBoundary: () =>
    new TerritoryBoundaryUseCases({
      territoryRepository: territoryRepositories.territory,
      spatialRepository: territoryRepositories.spatial,
      onBoundaryChanged: enqueueMembershipRecompute,
    }),
  recomputeMembership: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: clinicMembershipWriter,
    }),
  listUnassignedClinics: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: clinicMembershipWriter,
    }),
  adminOverrideClinicTerritory: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: clinicMembershipWriter,
    }),
  unlockClinicGeo: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: clinicMembershipWriter,
    }),
  submitApproval: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      territoryCrud,
      clinicWriter: clinicMembershipWriter,
      invalidateScopeForTerritories,
      enqueueMembershipRecompute,
      auditLog: auditLogAdapter,
    }),
  listApprovalRequests: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      territoryCrud,
      clinicWriter: clinicMembershipWriter,
    }),
  approveRequest: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      territoryCrud,
      clinicWriter: clinicMembershipWriter,
      invalidateScopeForTerritories,
      enqueueMembershipRecompute,
      auditLog: auditLogAdapter,
    }),
  rejectRequest: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      territoryCrud,
      clinicWriter: clinicMembershipWriter,
    }),
};
