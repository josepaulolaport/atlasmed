import { describe, expect, it, mock } from 'bun:test'
import { OperationNotAllowedError, UserNotFoundError } from '../../../../shared/errors'
import { createMockAuditLogService } from '../../test-helpers/audit-mocks'
import { createMockAuthCache, createMockUserRepository } from '../../test-helpers/fixtures'
import { ActivateUserUseCase } from './activate-user.use-case'

describe('ActivateUserUseCase', () => {
  it('should activate inactive user', async () => {
    const activate = mock(async () => {})
    const userRepository = createMockUserRepository({
      findById: mock(async () => ({
        id: 'user-1',
        status: 'INACTIVE'
      })) as any,
      activate
    })

    const useCase = new ActivateUserUseCase({
      userRepository,
      authCache: createMockAuthCache(),
      auditLog: createMockAuditLogService()
    })

    await useCase.execute({ userId: 'user-1', activatedBy: 'admin-1' })

    expect(activate).toHaveBeenCalledWith('user-1')
  })

  it('should throw when user not found', async () => {
    const useCase = new ActivateUserUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null)
      }),
      authCache: createMockAuthCache(),
      auditLog: createMockAuditLogService()
    })

    await expect(useCase.execute({ userId: 'missing', activatedBy: 'admin-1' })).rejects.toThrow(
      UserNotFoundError
    )
  })

  it('should throw when already active', async () => {
    const useCase = new ActivateUserUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({ id: 'user-1', status: 'ACTIVE' })) as any
      }),
      authCache: createMockAuthCache(),
      auditLog: createMockAuditLogService()
    })

    await expect(useCase.execute({ userId: 'user-1', activatedBy: 'admin-1' })).rejects.toThrow(
      OperationNotAllowedError
    )
  })
})
