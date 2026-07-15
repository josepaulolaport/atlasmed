import { describe, expect, it } from 'bun:test'
import { createGlobalScopeContext, withTerritoryScopeAliases } from '@atlasmed/access'
import { ForbiddenError } from '../../../../shared/errors'
import {
  CreateProfessionalNoteUseCase,
  ListProfessionalNotesUseCase
} from './professional.use-cases'

const professional = {
  id: 'professional-1',
  facilityIds: ['facility-1']
}

function createRepository() {
  const notes = [
    {
      id: 'note-other-user',
      professionalId: 'professional-1',
      userId: 'user-other',
      note: 'Nota de outra pessoa',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z')
    }
  ]

  return {
    findById: async () => professional,
    findNotesByProfessionalAndUser: async (professionalId: string, userId: string) =>
      notes.filter((note) => note.professionalId === professionalId && note.userId === userId),
    createNote: async (input: { professionalId: string; userId: string; note: string }) => {
      const note = {
        id: 'note-new',
        ...input,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
        updatedAt: new Date('2026-01-02T10:00:00.000Z')
      }
      notes.push(note)
      return note
    }
  }
}

describe('professional notes use cases', () => {
  it('lists only notes authored by the authenticated user', async () => {
    const repository = createRepository()
    const useCase = new ListProfessionalNotesUseCase({
      doctorRepository: repository as any
    })

    const result = await useCase.execute({
      professionalId: 'professional-1',
      userId: 'user-current',
      scope: createGlobalScopeContext()
    })

    expect(result).toEqual([])
  })

  it('creates a note for the authenticated user and returns its DTO', async () => {
    const repository = createRepository()
    const useCase = new CreateProfessionalNoteUseCase({
      doctorRepository: repository as any
    })

    const result = await useCase.execute({
      professionalId: 'professional-1',
      userId: 'user-current',
      note: 'Lembrar de confirmar o retorno.',
      scope: createGlobalScopeContext()
    })

    expect(result).toEqual({
      id: 'note-new',
      note: 'Lembrar de confirmar o retorno.',
      createdAt: '2026-01-02T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z'
    })
  })

  it('rejects access to a professional outside the user scope', async () => {
    const repository = createRepository()
    const useCase = new ListProfessionalNotesUseCase({
      doctorRepository: repository as any
    })
    const scope = withTerritoryScopeAliases({
      isGlobal: false,
      assignedTerritoryIds: [],
      effectiveTerritoryIds: [],
      analyticsEffectiveTerritoryIds: [],
      facilityIds: ['facility-other'],
      analyticsFacilityIds: [],
      managedUserIds: [],
      isOperationallyActive: true
    })

    await expect(
      useCase.execute({
        professionalId: 'professional-1',
        userId: 'user-current',
        scope
      })
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})
