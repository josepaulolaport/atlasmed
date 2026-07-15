import { Role } from '@atlasmed/access'
import { InsufficientPermissionsError, UserNotFoundError } from '../../../../shared/errors'
import type { ScopeRepository } from '../interfaces/scope.repository.interface'
import type { UserRepository } from '../interfaces/user.repository.interface'

interface GetUserAssignmentsDependencies {
  userRepository: UserRepository
  scopeRepository: ScopeRepository
}

export interface GetUserAssignmentsOutput {
  userId: string
  managerId: string | null
  manager: {
    id: string
    username: string
    email: string
    firstName?: string
    lastName?: string
  } | null
  territories: Array<{ territoryId: string; assignedAt: string }>
  sectors: Array<{ sectorId: string; assignedAt: string }>
  isOperationallyActive: boolean
}

export class GetUserAssignmentsUseCase {
  constructor(private readonly deps: GetUserAssignmentsDependencies) {}

  async execute(params: {
    targetUserId: string
    actorRole: Role
    self?: boolean
  }): Promise<GetUserAssignmentsOutput> {
    if (!params.self && params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ['user:read_assignments'],
        [`role:${params.actorRole}`]
      )
    }

    const user = await this.deps.userRepository.findById(params.targetUserId)

    if (!user) {
      throw new UserNotFoundError(params.targetUserId)
    }

    const managerId = user.managerId ?? null
    let manager: GetUserAssignmentsOutput['manager'] = null

    if (managerId) {
      const managerUser = await this.deps.userRepository.findById(managerId)

      if (managerUser) {
        manager = {
          id: managerUser.id,
          username: managerUser.username,
          email: managerUser.email!,
          ...(managerUser.firstName ? { firstName: managerUser.firstName } : {}),
          ...(managerUser.lastName ? { lastName: managerUser.lastName } : {})
        }
      }
    }

    const [territoryAssignments, sectorAssignments] = await Promise.all([
      this.deps.scopeRepository.findTerritoryAssignmentsByUserId(params.targetUserId),
      this.deps.scopeRepository.findSectorAssignmentsByUserId(params.targetUserId)
    ])

    const roleName = user.role?.name ?? Role.REP
    const isOperationallyActive = roleName === Role.REP && territoryAssignments.length > 0

    return {
      userId: params.targetUserId,
      managerId,
      manager,
      territories: territoryAssignments.map((assignment) => ({
        territoryId: assignment.territoryId,
        assignedAt: assignment.assignedAt.toISOString()
      })),
      sectors: sectorAssignments.map((assignment) => ({
        sectorId: assignment.sectorId,
        assignedAt: assignment.assignedAt.toISOString()
      })),
      isOperationallyActive
    }
  }
}
