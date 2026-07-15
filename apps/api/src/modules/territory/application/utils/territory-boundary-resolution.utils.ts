import type { TerritoryBoundaryResolution } from '../services/territory-boundary.application'

export function serializeBoundaryResolution(resolution: TerritoryBoundaryResolution) {
  if (resolution.mode === 'rep_patch') {
    return {
      success: true as const,
      mode: 'rep_patch' as const,
      managerTerritoryId: resolution.managerTerritoryId,
      managerZoneCandidates: resolution.managerZoneCandidates,
      clinicRecomputeEnqueued: resolution.clinicRecomputeEnqueued
    }
  }

  if (resolution.mode === 'manager_zone') {
    return {
      success: true as const,
      mode: 'manager_zone' as const,
      repPatchCount: resolution.repPatchCount
    }
  }

  return {
    success: true as const,
    mode: 'grouping' as const
  }
}
