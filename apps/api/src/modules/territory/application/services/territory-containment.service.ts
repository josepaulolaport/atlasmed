import { OperationNotAllowedError } from '../../../../shared/errors'
import { GEO_SIBLING_OVERLAP_BLOCK_RATIO } from '../constants/territory-geo.constants'
import { isManagerZoneType, isRepPatchType } from '../constants/territory-roles.constants'
import type {
  TerritoryRecord,
  TerritoryRepository
} from '../interfaces/territory.repository.interface'
import type {
  GeoJsonGeometry,
  TerritorySpatialRepository
} from '../interfaces/territory-spatial.repository.interface'
import type { TerritoryTypeRepository } from '../interfaces/territory-type.repository.interface'

export interface ManagerZoneCandidate {
  id: string
  code: string
  name: string
}

export interface RepPatchContainmentResolution {
  managerTerritoryId: string
  candidates: ManagerZoneCandidate[]
}

export class TerritoryContainmentService {
  constructor(
    private readonly deps: {
      territoryRepository: TerritoryRepository
      territoryTypeRepository: TerritoryTypeRepository
      spatialRepository: TerritorySpatialRepository
    }
  ) {}

  async assertSiblingOverlapAllowed(
    territory: TerritoryRecord,
    geoJson: GeoJsonGeometry
  ): Promise<void> {
    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId))
    if (!type?.blockSiblingOverlap) {
      return
    }

    const conflicts = await this.deps.spatialRepository.findOverlappingSiblingTerritories({
      territoryId: territory.id,
      territoryTypeId: territory.territoryTypeId,
      countryCode: territory.countryCode ?? 'BR',
      geoJson
    })

    const substantial = conflicts.filter((c) => c.overlapRatio > GEO_SIBLING_OVERLAP_BLOCK_RATIO)
    if (substantial.length > 0) {
      throw new OperationNotAllowedError(
        'save_boundary',
        `Boundary substantially overlaps sibling territories: ${substantial
          .map((c) => `${c.code} (${Math.round(c.overlapRatio * 100)}%)`)
          .join(', ')}`
      )
    }
  }

  async resolveRepPatchManagerZone(
    geoJson: GeoJsonGeometry,
    countryCode: string
  ): Promise<RepPatchContainmentResolution> {
    const candidates = await this.deps.spatialRepository.findContainingManagerZones({
      geoJson,
      countryCode
    })

    if (candidates.length === 0) {
      throw new OperationNotAllowedError(
        'save_boundary',
        'Rep patch must be fully contained inside exactly one active manager zone'
      )
    }

    if (candidates.length > 1) {
      throw new OperationNotAllowedError(
        'save_boundary',
        `Rep patch must be inside exactly one manager zone; found ${candidates.length}: ${candidates
          .map((c) => c.code)
          .join(', ')}`
      )
    }

    return {
      managerTerritoryId: candidates[0]?.id,
      candidates
    }
  }

  async assertManagerZoneContainsChildPatches(
    managerZoneId: string,
    geoJson: GeoJsonGeometry
  ): Promise<void> {
    const orphans = await this.deps.spatialRepository.findRepPatchesOutsideManagerZone({
      managerZoneId,
      managerZoneGeoJson: geoJson
    })

    if (orphans.length > 0) {
      throw new OperationNotAllowedError(
        'save_boundary',
        `Manager zone boundary no longer contains rep patches: ${orphans
          .map((p) => p.code)
          .join(', ')}`
      )
    }
  }

  async validateTerritoryRoleForBoundarySave(territory: TerritoryRecord): Promise<void> {
    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId))
    if (!type) {
      throw new OperationNotAllowedError('save_boundary', 'Territory type not found')
    }

    if (!isRepPatchType(type) && !isManagerZoneType(type) && !type.canHaveBoundary) {
      throw new OperationNotAllowedError(
        'save_boundary',
        'This territory type cannot have a boundary'
      )
    }
  }
}
