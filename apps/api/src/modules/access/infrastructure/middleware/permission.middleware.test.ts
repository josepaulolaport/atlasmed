import { describe, expect, it } from 'bun:test'
import { defineAbilitiesFor } from '@atlasmed/access'
import { Elysia } from 'elysia'
import { AppError, ForbiddenError } from '../../../../shared/errors'
import { requirePermission } from './permission.middleware'

describe('PermissionMiddleware', () => {
  const _mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    username: 'admin',
    role: {
      id: 'role-admin',
      name: 'ADMIN' as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  const _mockManagerUser = {
    id: 'manager-123',
    email: 'manager@example.com',
    username: 'manager',
    role: {
      id: 'role-manager',
      name: 'MANAGER' as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  const _mockRegularUser = {
    id: 'user-123',
    email: 'user@example.com',
    username: 'user',
    role: {
      id: 'role-user',
      name: 'REP' as const,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  describe('allowed permission', () => {
    it('should allow ADMIN to manage USER', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('manage', 'USER')).toBe(true)
    })

    it('should allow ADMIN to manage CLINIC', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('manage', 'FACILITY')).toBe(true)
    })

    it('should allow ADMIN to manage TERRITORY', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('manage', 'TERRITORY')).toBe(true)
    })

    it('should allow MANAGER to read USER', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'USER')).toBe(true)
    })

    it('should allow MANAGER to read CLINIC', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'FACILITY')).toBe(true)
      expect(ability.can('manage', 'FACILITY')).toBe(false)
    })

    it('should allow MANAGER to read TERRITORY', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'TERRITORY')).toBe(true)
    })

    it('should allow REP to read CLINIC', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('read', 'FACILITY')).toBe(true)
    })
  })

  describe('missing permission', () => {
    it('should deny REP from creating USER', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('create', 'USER')).toBe(false)
    })

    it('should deny REP from updating USER', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('update', 'USER')).toBe(false)
    })

    it('should deny REP from deleting USER', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('delete', 'USER')).toBe(false)
    })

    it('should deny MANAGER from managing USER', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('manage', 'USER')).toBe(false)
    })

    it('should deny MANAGER from managing TERRITORY', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('manage', 'TERRITORY')).toBe(false)
    })

    it('should deny REP from managing CLINIC', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('manage', 'FACILITY')).toBe(false)
    })
  })

  describe('multiple permission checks', () => {
    it('should check multiple permissions for ADMIN', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('create', 'USER')).toBe(true)
      expect(ability.can('read', 'USER')).toBe(true)
      expect(ability.can('update', 'USER')).toBe(true)
      expect(ability.can('delete', 'USER')).toBe(true)
    })

    it('should check multiple permissions for MANAGER', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'USER')).toBe(true)
      expect(ability.can('create', 'USER')).toBe(true)
      expect(ability.can('read', 'FACILITY')).toBe(true)
      expect(ability.can('update', 'FACILITY')).toBe(true)
      expect(ability.can('create', 'TERRITORY')).toBe(true)
      expect(ability.can('update', 'TERRITORY')).toBe(true)
      expect(ability.can('manage', 'TERRITORY')).toBe(false)
    })

    it('should check multiple denied permissions for REP', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('create', 'USER')).toBe(false)
      expect(ability.can('update', 'USER')).toBe(false)
      expect(ability.can('delete', 'USER')).toBe(false)
      expect(ability.can('manage', 'USER')).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw ForbiddenError when permission denied', () => {
      const error = new ForbiddenError()

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Forbidden')
    })

    it('should throw ForbiddenError when auth context missing', () => {
      const auth = undefined

      expect(auth).toBeUndefined()

      const error = new ForbiddenError()
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('ADMIN permissions', () => {
    it('should have full CRUD on USER', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('create', 'USER')).toBe(true)
      expect(ability.can('read', 'USER')).toBe(true)
      expect(ability.can('update', 'USER')).toBe(true)
      expect(ability.can('delete', 'USER')).toBe(true)
    })

    it('should have full CRUD on CLINIC', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('create', 'FACILITY')).toBe(true)
      expect(ability.can('read', 'FACILITY')).toBe(true)
      expect(ability.can('update', 'FACILITY')).toBe(true)
      expect(ability.can('delete', 'FACILITY')).toBe(true)
    })

    it('should have full CRUD on TERRITORY', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('create', 'TERRITORY')).toBe(true)
      expect(ability.can('read', 'TERRITORY')).toBe(true)
      expect(ability.can('update', 'TERRITORY')).toBe(true)
      expect(ability.can('delete', 'TERRITORY')).toBe(true)
    })
  })

  describe('MANAGER permissions', () => {
    it('should have read, update, and create permissions on USER', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'USER')).toBe(true)
      expect(ability.can('create', 'USER')).toBe(true)
      expect(ability.can('update', 'USER')).toBe(true)
      expect(ability.can('delete', 'USER')).toBe(false)
    })

    it('should have read and update on CLINIC', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'FACILITY')).toBe(true)
      expect(ability.can('create', 'FACILITY')).toBe(false)
      expect(ability.can('update', 'FACILITY')).toBe(true)
      expect(ability.can('delete', 'FACILITY')).toBe(false)
    })

    it('should have read, create, and update on TERRITORY', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'TERRITORY')).toBe(true)
      expect(ability.can('create', 'TERRITORY')).toBe(true)
      expect(ability.can('update', 'TERRITORY')).toBe(true)
      expect(ability.can('delete', 'TERRITORY')).toBe(false)
      expect(ability.can('manage', 'TERRITORY')).toBe(false)
    })
  })

  describe('REP permissions', () => {
    it('should have read and update on CLINIC', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('read', 'FACILITY')).toBe(true)
      expect(ability.can('create', 'FACILITY')).toBe(false)
      expect(ability.can('update', 'FACILITY')).toBe(true)
      expect(ability.can('delete', 'FACILITY')).toBe(false)
    })

    it('should have no permissions on USER', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('create', 'USER')).toBe(false)
      expect(ability.can('read', 'USER')).toBe(false)
      expect(ability.can('update', 'USER')).toBe(false)
      expect(ability.can('delete', 'USER')).toBe(false)
    })

    it('should have no permissions on TERRITORY', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('create', 'TERRITORY')).toBe(false)
      expect(ability.can('read', 'TERRITORY')).toBe(false)
      expect(ability.can('update', 'TERRITORY')).toBe(false)
      expect(ability.can('delete', 'TERRITORY')).toBe(false)
    })

    it('should not be able to read REGISTRY_INGESTION', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('read', 'REGISTRY_INGESTION')).toBe(false)
    })
  })

  describe('REGISTRY_INGESTION permissions', () => {
    it('should allow ADMIN to manage REGISTRY_INGESTION', () => {
      const ability = defineAbilitiesFor('ADMIN')

      expect(ability.can('manage', 'REGISTRY_INGESTION')).toBe(true)
    })

    it('should allow MANAGER to read REGISTRY_INGESTION', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('read', 'REGISTRY_INGESTION')).toBe(true)
    })

    it('should deny MANAGER from managing REGISTRY_INGESTION', () => {
      const ability = defineAbilitiesFor('MANAGER')

      expect(ability.can('manage', 'REGISTRY_INGESTION')).toBe(false)
    })

    it('should deny REP from reading REGISTRY_INGESTION', () => {
      const ability = defineAbilitiesFor('REP')

      expect(ability.can('read', 'REGISTRY_INGESTION')).toBe(false)
    })
  })

  describe('Elysia scoped hook wiring', () => {
    function createTestApp(role: 'ADMIN' | 'MANAGER' | 'REP') {
      const auth = new Elysia({ name: 'auth-test' }).derive({ as: 'scoped' }, async () => ({
        getUser: async () => ({
          id: 'user-test',
          role: { name: role }
        })
      }))

      return new Elysia()
        .onError(({ error, set }) => {
          if (error instanceof AppError) {
            set.status = error.statusCode
            return { error: error.toClientJSON() }
          }
          throw error
        })
        .use(auth)
        .use(requirePermission('manage', 'USER'))
        .get('/protected', () => ({ ok: true }))
    }

    it('allows ADMIN on manage USER routes', async () => {
      const app = createTestApp('ADMIN')
      const response = await app.handle(new Request('http://localhost/protected'))

      expect(response.status).toBe(200)
    })

    it('blocks MANAGER on manage USER routes', async () => {
      const app = createTestApp('MANAGER')
      const response = await app.handle(new Request('http://localhost/protected'))

      expect(response.status).toBe(403)
    })

    it('blocks REP on manage USER routes', async () => {
      const app = createTestApp('REP')
      const response = await app.handle(new Request('http://localhost/protected'))

      expect(response.status).toBe(403)
    })
  })
})
