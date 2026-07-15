import { Role } from '@atlasmed/access'
import { roles, users, userTerritoryAssignments } from '@atlasmed/database'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '../../../../infrastructure/database/db'
import { OperationNotAllowedError } from '../../../../shared/errors'
import type { TerritoryRepository } from '../interfaces/territory.repository.interface'
import type { TerritoryClosureRepository } from '../interfaces/territory-closure.repository.interface'
import type { TerritoryTypeRepository } from '../interfaces/territory-type.repository.interface'

interface Dependencies {
  territoryRepository: TerritoryRepository
  territoryTypeRepository: TerritoryTypeRepository
  closureRepository: TerritoryClosureRepository
}

export class TerritoryAssignmentPolicyService {
  constructor(private readonly deps: Dependencies) {}

  async validateAssignment(params: {
    targetUserId: string
    targetRole: Role
    territoryId: string
  }): Promise<void> {
    const territory = await this.deps.territoryRepository.findById(params.territoryId)
    if (!territory || !territory.isActive) {
      throw new OperationNotAllowedError(
        'assign_territory',
        'Territory does not exist or is inactive'
      )
    }

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId))
    if (!type) {
      throw new OperationNotAllowedError('assign_territory', 'Territory type not found')
    }

    if (params.targetRole !== Role.REP && params.targetRole !== Role.MANAGER) {
      throw new OperationNotAllowedError(
        'assign_territory',
        'Territory assignments are only supported for REP and MANAGER accounts'
      )
    }

    if (params.targetRole === Role.REP && !type.assignableToUsers) {
      throw new OperationNotAllowedError(
        'assign_territory',
        'This territory type cannot be assigned to field reps'
      )
    }

    if (params.targetRole === Role.MANAGER && !type.assignableToManagers) {
      throw new OperationNotAllowedError(
        'assign_territory',
        'This territory type cannot be assigned to managers'
      )
    }

    const exclusionRoles = params.targetRole === Role.MANAGER ? [Role.MANAGER] : [Role.REP]

    const conflictingAssignments = await db
      .select({
        territoryId: userTerritoryAssignments.territoryId,
        userId: userTerritoryAssignments.userId
      })
      .from(userTerritoryAssignments)
      .innerJoin(users, eq(userTerritoryAssignments.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          ne(userTerritoryAssignments.userId, params.targetUserId),
          inArray(roles.name, exclusionRoles)
        )
      )

    for (const assignment of conflictingAssignments) {
      const overlaps = await this.deps.closureRepository.hasAncestorDescendantRelation(
        assignment.territoryId,
        params.territoryId
      )
      if (overlaps) {
        throw new OperationNotAllowedError(
          'assign_territory',
          'Territory overlaps with an assignment held by another user in the same role group'
        )
      }
    }
  }
}
