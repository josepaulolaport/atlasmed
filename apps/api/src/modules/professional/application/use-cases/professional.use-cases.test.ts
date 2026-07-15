import { describe, expect, it } from 'bun:test'
import type { ScopeContext } from '@atlasmed/access'
import type {
  ProfessionalRecord,
  ProfessionalRepository
} from '../interfaces/professional.repository.interface'
import { ListProfessionalsUseCase } from './professional.use-cases'

const now = new Date('2026-01-01T00:00:00.000Z')

function professionalRecord(id: string): ProfessionalRecord {
  return {
    id,
    firstName: 'Ana',
    lastName: 'Silva',
    fullName: 'Ana Silva',
    socialName: null,
    taxId: null,
    birthDate: null,
    mobilePhone: null,
    landlinePhone: null,
    email: null,
    websiteUrl: null,
    imageUrl: null,
    favoriteTeam: null,
    favoriteSport: null,
    hobbies: null,
    notes: null,
    specialty: 'Cardiologia',
    crmCouncil: null,
    crmNumber: '123456',
    crmState: 'SP',
    sourceProvider: null,
    externalSourceId: null,
    sourceContentHash: null,
    sourceFirstSeenAt: null,
    sourceLastSeenAt: null,
    sourcePresent: true,
    sourceTracked: false,
    manuallyEditedAt: null,
    facilityIds: ['facility-1'],
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
}

function fakeRepository(findAll: ProfessionalRepository['findAll']): ProfessionalRepository {
  return {
    findAll,
    findById: async () => null,
    findByExternalId: async () => null,
    findSourceTrackedByProvider: async () => [],
    findActiveFacilities: async () => [],
    create: async () => professionalRecord('created'),
    update: async () => professionalRecord('updated'),
    softDelete: async () => {},
    markSourceAbsent: async () => {},
    upsertFromSource: async () => ({
      professional: professionalRecord('upserted'),
      created: true,
      updated: false
    }),
    findExistingFacilityIds: async (ids) => ids,
    findNotesByProfessionalAndUser: async () => [],
    createNote: async () => ({
      id: 'note-1',
      userId: 'user-1',
      professionalId: 'professional-1',
      note: 'note',
      createdAt: now,
      updatedAt: now
    })
  }
}

describe('ListProfessionalsUseCase', () => {
  it('returns pagination totals from the repository', async () => {
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async () => ({
        professionals: [professionalRecord('doctor-1')],
        total: 42
      }))
    })

    const result = await useCase.execute({
      page: 2,
      limit: 20,
      scope: {
        isGlobal: true,
        assignedTerritoryIds: [],
        effectiveTerritoryIds: [],
        analyticsEffectiveTerritoryIds: [],
        territoryIds: [],
        facilityIds: [],
        analyticsFacilityIds: [],
        clinicIds: [],
        analyticsClinicIds: [],
        managedUserIds: [],
        isOperationallyActive: true
      }
    })

    expect(result.data).toHaveLength(1)
    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3
    })
  })

  it('passes scoped facility ids to the repository', async () => {
    let receivedScope: unknown
    const scope: ScopeContext = {
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
    const useCase = new ListProfessionalsUseCase({
      doctorRepository: fakeRepository(async (params) => {
        receivedScope = params.scope
        return { professionals: [], total: 0 }
      })
    })

    await useCase.execute({ scope })

    expect(receivedScope).toEqual({
      isGlobal: false,
      facilityIds: ['facility-1']
    })
  })
})
