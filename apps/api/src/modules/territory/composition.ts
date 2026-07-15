import { territoryMembershipQueue } from '../../infrastructure/jobs/territory-membership.queue'
import { auditLogAdapter } from '../access/infrastructure/adapters/audit-log.adapter'
import { scopeCacheService } from '../access/infrastructure/cache/scope-cache.service'
import { TerritoryAssignmentPolicyService } from './application/services/territory-assignment-policy.service'
import { TerritoryClosureService } from './application/services/territory-closure.service'
import { TerritoryContainmentService } from './application/services/territory-containment.service'
import { TerritoryMembershipService } from './application/services/territory-membership.service'
import { TerritoryApprovalUseCases } from './application/use-cases/territory-approval.use-cases'
import { TerritoryBoundaryUseCases } from './application/use-cases/territory-boundary.use-cases'
import { TerritoryCoverageUseCases } from './application/use-cases/territory-coverage.use-cases'
import { TerritoryCrudUseCases } from './application/use-cases/territory-crud.use-cases'
import { TerritoryMembershipUseCases } from './application/use-cases/territory-membership.use-cases'
import { TerritoryTypeUseCases } from './application/use-cases/territory-type.use-cases'
import { DrizzleClinicMembershipWriter } from './infrastructure/adapters/drizzle-facility-membership.writer'
import { DrizzleTerritoryHierarchyPort } from './infrastructure/ports/drizzle-territory-hierarchy.port'
import { DrizzleTerritoryRepository } from './infrastructure/repositories/drizzle/drizzle-territory.repository'
import { DrizzleTerritoryApprovalRepository } from './infrastructure/repositories/drizzle/drizzle-territory-approval.repository'
import { DrizzleTerritoryClosureRepository } from './infrastructure/repositories/drizzle/drizzle-territory-closure.repository'
import { DrizzleTerritorySpatialRepository } from './infrastructure/repositories/drizzle/drizzle-territory-spatial.repository'
import { DrizzleTerritoryTypeRepository } from './infrastructure/repositories/drizzle/drizzle-territory-type.repository'

export const territoryRepositories = {
  territory: new DrizzleTerritoryRepository(),
  territoryType: new DrizzleTerritoryTypeRepository(),
  closure: new DrizzleTerritoryClosureRepository(),
  spatial: new DrizzleTerritorySpatialRepository(),
  approval: new DrizzleTerritoryApprovalRepository()
}

export const facilityMembershipWriter = new DrizzleClinicMembershipWriter()

export const territoryHierarchyPort = new DrizzleTerritoryHierarchyPort(
  territoryRepositories.closure,
  territoryRepositories.territory
)

const territoryClosureService = new TerritoryClosureService({
  territoryRepository: territoryRepositories.territory,
  closureRepository: territoryRepositories.closure
})

const territoryMembershipService = new TerritoryMembershipService({
  spatialRepository: territoryRepositories.spatial,
  territoryRepository: territoryRepositories.territory,
  clinicWriter: facilityMembershipWriter
})

const territoryContainmentService = new TerritoryContainmentService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  spatialRepository: territoryRepositories.spatial
})

async function enqueueMembershipRecompute(territoryId?: string): Promise<void> {
  await territoryMembershipQueue.enqueue({
    territoryId,
    reason: territoryId ? 'boundary_change' : 'manual_recompute'
  })
}

async function onTerritoryBoundaryChanged(territoryId: string): Promise<void> {
  await enqueueMembershipRecompute(territoryId)
  await invalidateScopeForTerritories([territoryId])
}

async function onManagerTerritoryChanged(managerTerritoryId: string): Promise<void> {
  await invalidateScopeForTerritories([managerTerritoryId])
}

async function enqueueClinicMembershipUpdate(facilityId: string): Promise<void> {
  await territoryMembershipQueue.enqueue({
    facilityIds: [facilityId],
    reason: 'clinic_update'
  })
}

async function invalidateScopeForTerritories(territoryIds: string[]): Promise<void> {
  const userIds = await territoryHierarchyPort.findUsersAssignedToTerritoryAncestors(territoryIds)
  await scopeCacheService.invalidateMany(userIds)
}

export function registerTerritoryMembershipWorker(): void {
  territoryMembershipQueue.registerHandler(async (job) => {
    if (job.facilityIds?.length) {
      for (const facilityId of job.facilityIds) {
        await territoryMembershipService.assignFacilityById(facilityId)
      }
      return
    }

    if (job.territoryId) {
      await territoryMembershipService.recomputeForTerritoryBoundary(job.territoryId)
    } else {
      await territoryMembershipService.recomputeAll()
    }
  })
}

const territoryCrud = new TerritoryCrudUseCases({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  closureRepository: territoryRepositories.closure,
  spatialRepository: territoryRepositories.spatial,
  containmentService: territoryContainmentService,
  closureService: territoryClosureService,
  onTerritoryDeactivated: enqueueMembershipRecompute,
  onBoundaryChanged: onTerritoryBoundaryChanged,
  onManagerTerritoryChanged: onManagerTerritoryChanged
})

const territoryTypeCrud = new TerritoryTypeUseCases(territoryRepositories.territoryType)

function createBoundaryUseCases() {
  return new TerritoryBoundaryUseCases({
    territoryRepository: territoryRepositories.territory,
    territoryTypeRepository: territoryRepositories.territoryType,
    spatialRepository: territoryRepositories.spatial,
    closureRepository: territoryRepositories.closure,
    containmentService: territoryContainmentService,
    onBoundaryChanged: onTerritoryBoundaryChanged,
    onManagerTerritoryChanged: onManagerTerritoryChanged
  })
}

export { enqueueClinicMembershipUpdate, territoryMembershipService }

export const territoryAssignmentPolicy = new TerritoryAssignmentPolicyService({
  territoryRepository: territoryRepositories.territory,
  territoryTypeRepository: territoryRepositories.territoryType,
  closureRepository: territoryRepositories.closure
})

export const territoryUseCases = {
  listTerritories: () => territoryCrud,
  createTerritory: () => territoryCrud,
  getTerritory: () => territoryCrud,
  updateTerritory: () => territoryCrud,
  deactivateTerritory: () => territoryCrud,
  getDescendants: () => territoryCrud,
  listGroupingTree: () => territoryCrud,
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
      clinicWriter: facilityMembershipWriter
    }),
  listUnassignedFacilities: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter
    }),
  adminOverrideClinicTerritory: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter
    }),
  unlockClinicGeo: () =>
    new TerritoryMembershipUseCases({
      territoryRepository: territoryRepositories.territory,
      membershipService: territoryMembershipService,
      clinicWriter: facilityMembershipWriter
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
      auditLog: auditLogAdapter
    }),
  listApprovalRequests: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      territoryCrud,
      clinicWriter: facilityMembershipWriter
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
      auditLog: auditLogAdapter
    }),
  rejectRequest: () =>
    new TerritoryApprovalUseCases({
      approvalRepository: territoryRepositories.approval,
      territoryRepository: territoryRepositories.territory,
      closureRepository: territoryRepositories.closure,
      territoryCrud,
      clinicWriter: facilityMembershipWriter
    }),
  getAnalyticsView: () =>
    new TerritoryCoverageUseCases({
      territoryRepository: territoryRepositories.territory,
      territoryTypeRepository: territoryRepositories.territoryType,
      spatialRepository: territoryRepositories.spatial,
      closureRepository: territoryRepositories.closure,
      hierarchyPort: territoryHierarchyPort
    })
}
