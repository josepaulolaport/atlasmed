import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { createGlobalScopeContext, Role } from '@atlasmed/access'
import { OperationNotAllowedError, UserNotFoundError } from '../../../../shared/errors'
import { createMockAuditLogService } from '../../test-helpers/audit-mocks'
import { createMockAuthCache, createMockUserRepository } from '../../test-helpers/fixtures'
import type { IAuthCache } from '../interfaces/auth-cache.interface'
import type { UserRepository } from '../interfaces/user.repository.interface'
import { UnsuspendUserUseCase } from './unsuspend-user.use-case'

function adminUnsuspendParams(userId: string, unsuspendedBy = 'admin-123') {
  return {
    userId,
    unsuspendedBy,
    actorRole: Role.ADMIN,
    scope: createGlobalScopeContext()
  }
}

describe('UnsuspendUserUseCase', () => {
  let useCase: UnsuspendUserUseCase
  let mockUserRepository: UserRepository
  let mockAuthCache: IAuthCache
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>

  const suspendedUser = {
    id: 'user-123',
    status: 'SUSPENDED',
    managerId: null
  }

  beforeEach(() => {
    mockAuditLog = createMockAuditLogService()
    mockUserRepository = createMockUserRepository({
      findById: mock(async () => suspendedUser) as any
    })
    mockAuthCache = createMockAuthCache()

    useCase = new UnsuspendUserUseCase({
      userRepository: mockUserRepository,
      authCache: mockAuthCache,
      auditLog: mockAuditLog
    })
  })

  it('should unsuspend user and invalidate auth cache', async () => {
    await useCase.execute(adminUnsuspendParams('user-123'))

    expect(mockUserRepository.unsuspend).toHaveBeenCalledWith('user-123')
    expect(mockAuthCache.invalidate).toHaveBeenCalledWith('user-123')
    expect(mockAuditLog.logUserStatusChange).toHaveBeenCalledWith({
      userId: 'admin-123',
      targetUserId: 'user-123',
      oldStatus: 'SUSPENDED',
      newStatus: 'ACTIVE'
    })
  })

  it('should throw when user not found', async () => {
    mockUserRepository.findById = mock(async () => null)

    await expect(useCase.execute(adminUnsuspendParams('missing'))).rejects.toThrow(
      UserNotFoundError
    )

    expect(mockUserRepository.unsuspend).not.toHaveBeenCalled()
  })

  it('should throw when user is not suspended', async () => {
    mockUserRepository.findById = mock(async () => ({
      ...suspendedUser,
      status: 'ACTIVE'
    })) as any

    await expect(useCase.execute(adminUnsuspendParams('user-123'))).rejects.toThrow(
      OperationNotAllowedError
    )

    expect(mockUserRepository.unsuspend).not.toHaveBeenCalled()
  })
})
