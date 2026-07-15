import { describe, expect, it, mock } from 'bun:test'
import { OperationNotAllowedError, ResourceNotFoundError } from '../../../../shared/errors'
import { TerritoryCoverageUseCases } from './territory-coverage.use-cases'

const globalScope = {
  isGlobal: true,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: []
} as never

const groupingTerritory = {
  id: 'grouping-1',
  name: 'RJ',
  slug: 'rj',
  code: 'RJ',
  territoryTypeId: 'tt_state',
  territoryType: {
    id: 'tt_state',
    slug: 'state',
    name: 'State',
    participatesInGroupingHierarchy: true
  }
}

const groupingBoundary = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-44, -23],
      [-43, -23],
      [-43, -22],
      [-44, -22],
      [-44, -23]
    ]
  ]
}

describe('TerritoryCoverageUseCases', () => {
  it('returns grouping boundary and scoped clinics grouped by rep patch', async () => {
    const useCases = new TerritoryCoverageUseCases({
      territoryRepository: {
        findById: mock(async (id: string) =>
          id === 'patch-1'
            ? {
                id: 'patch-1',
                name: 'Patch 1',
                code: 'PATCH-1',
                slug: 'patch-1',
                territoryType: { assignsClinics: true }
              }
            : groupingTerritory
        ),
        findActiveByTypeSlug: mock(async () => [{ id: 'patch-1' }]),
        findByIds: mock(async () => [])
      } as never,
      territoryTypeRepository: {
        findById: mock(async () => ({
          id: 'tt_state',
          slug: 'state',
          participatesInGroupingHierarchy: true
        }))
      } as never,
      spatialRepository: {
        getBoundaryAsGeoJson: mock(async () => groupingBoundary),
        findAssignedClinicsInGroupingTerritory: mock(async () => [
          {
            id: 'clinic-1',
            name: 'Facility A',
            lat: -22.5,
            lng: -43.5,
            territoryId: 'patch-1',
            repPatchCode: 'PATCH-1',
            repPatchName: 'Patch 1'
          }
        ])
      } as never,
      closureRepository: {} as never,
      hierarchyPort: {} as never
    })

    const result = await useCases.getAnalyticsView({
      groupingTerritoryId: 'grouping-1',
      scope: globalScope
    })

    expect(result.grouping.id).toBe('grouping-1')
    expect(result.clinicCount).toBe(1)
    expect(result.patchCount).toBe(1)
    expect(result.patches[0]?.facilities).toHaveLength(1)
  })

  it('rejects analytics view for non-grouping territory types', async () => {
    const useCases = new TerritoryCoverageUseCases({
      territoryRepository: {
        findById: mock(async () => ({
          id: 'patch-1',
          territoryTypeId: 'tt_patch',
          territoryType: {
            id: 'tt_patch',
            slug: 'patch',
            participatesInGroupingHierarchy: false
          }
        }))
      } as never,
      territoryTypeRepository: {
        findById: mock(async () => ({
          id: 'tt_patch',
          slug: 'patch',
          participatesInGroupingHierarchy: false
        }))
      } as never,
      spatialRepository: {} as never,
      closureRepository: {} as never,
      hierarchyPort: {} as never
    })

    await expect(
      useCases.getAnalyticsView({ groupingTerritoryId: 'patch-1', scope: globalScope })
    ).rejects.toThrow(OperationNotAllowedError)
  })

  it('throws when grouping territory is not found', async () => {
    const useCases = new TerritoryCoverageUseCases({
      territoryRepository: {
        findById: mock(async () => null)
      } as never,
      territoryTypeRepository: {} as never,
      spatialRepository: {} as never,
      closureRepository: {} as never,
      hierarchyPort: {} as never
    })

    await expect(
      useCases.getAnalyticsView({ groupingTerritoryId: 'missing', scope: globalScope })
    ).rejects.toThrow(ResourceNotFoundError)
  })
})
