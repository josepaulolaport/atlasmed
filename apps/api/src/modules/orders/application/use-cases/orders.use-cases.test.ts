import { describe, expect, it } from 'bun:test'
import type { ScopeContext } from '@atlasmed/access'
import { ForbiddenError } from '../../../../shared/errors'
import type { OrderRepository } from '../interfaces/order.repository.interface'
import { GetOrderUseCase, ListOrdersUseCase } from './orders.use-cases'

const scopedToFacilityOne: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: ['territory-1'],
  effectiveTerritoryIds: ['territory-1'],
  analyticsEffectiveTerritoryIds: ['territory-1'],
  territoryIds: ['territory-1'],
  facilityIds: ['facility-1'],
  analyticsFacilityIds: ['facility-1'],
  clinicIds: ['facility-1'],
  analyticsClinicIds: ['facility-1'],
  managedUserIds: [],
  isOperationallyActive: true
}

function createRepository(): OrderRepository {
  return {
    findAll: async (input) => ({
      orders: [
        {
          id: 'order-1',
          legacyId: 42,
          facility: { id: 'facility-1', name: 'Clínica Um' },
          professional: { id: 'professional-1', name: 'Dra. Ana' },
          seller: null,
          status: 'PENDING',
          type: 'STANDARD',
          orderedAt: new Date('2026-01-02T10:00:00Z'),
          createdAt: new Date('2026-01-01T10:00:00Z'),
          freight: 10,
          itemCount: 2,
          itemsTotal: 200
        }
      ],
      total: 1
    }),
    findById: async (id) =>
      id === 'order-2'
        ? {
            id,
            legacyId: null,
            facility: { id: 'facility-2', name: 'Clínica Dois' },
            professional: null,
            seller: null,
            status: 'APPROVED',
            type: 'STANDARD',
            orderedAt: null,
            createdAt: new Date('2026-01-01T10:00:00Z'),
            updatedAt: new Date('2026-01-01T10:00:00Z'),
            surgeryType: null,
            surgerySubtype: null,
            notes: null,
            freight: 0,
            grossWeight: 0,
            netWeight: 0,
            currency: 'BRL',
            usdExchangeRate: null,
            finalizedById: null,
            finalizedAt: null,
            rejectedById: null,
            rejectionReason: null,
            noBillingById: null,
            noBillingAt: null,
            noBillingNotes: null,
            expenseAuthorizedById: null,
            expenseAuthorizedAt: null,
            items: []
          }
        : null
  }
}

describe('orders use cases', () => {
  it('passes pagination, status, and facility scope to the repository', async () => {
    const repository = createRepository()
    const findAll = repository.findAll
    let received: Parameters<typeof findAll>[0] | null = null
    repository.findAll = async (input) => {
      received = input
      return findAll(input)
    }

    const result = await new ListOrdersUseCase({ orderRepository: repository }).execute({
      page: 2,
      limit: 10,
      statuses: ['PENDING', 'APPROVED'],
      scope: scopedToFacilityOne
    })

    expect(received).not.toBeNull()
    expect(received).toMatchObject({
      page: 2,
      limit: 10,
      statuses: ['PENDING', 'APPROVED'],
      scope: { isGlobal: false, facilityIds: ['facility-1'] }
    })
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 })
    expect(result.data[0]).toMatchObject({
      id: 'order-1',
      legacyId: 42,
      status: 'PENDING',
      facility: { name: 'Clínica Um' },
      total: 210,
      itemCount: 2
    })
  })

  it('denies detail access when its facility is outside the scope', async () => {
    const repository = createRepository()

    await expect(
      new GetOrderUseCase({ orderRepository: repository }).execute({
        orderId: 'order-2',
        scope: scopedToFacilityOne
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})
