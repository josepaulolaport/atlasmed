import type { ScopeContext } from '@atlasmed/access'
import { assertResourceInScope } from '@atlasmed/access'
import type { FacilityRepository } from '../interfaces/facility.repository.interface'
import type { FacilityGeocodingService } from '../services/facility-geocoding.service'

function serializeClinic(clinic: {
  id: string
  name: string
  taxIdType?: 'PJ' | 'PF' | null
  cnpj?: string | null
  cpf?: string | null
  lat: number | null
  lng: number | null
  territoryId: string | null
  territoryAssignmentStatus: 'assigned' | 'unassigned' | 'ambiguous'
  createdAt: Date
  updatedAt: Date
  professionalCount?: number
  consultantName?: string | null
  services?: Array<{ serviceCode: string; classificationCode: string }>
  distanceKm?: number | null
}) {
  return {
    id: clinic.id,
    name: clinic.name,
    taxIdType: clinic.taxIdType ?? null,
    cnpj: clinic.cnpj ?? null,
    cpf: clinic.cpf ?? null,
    lat: clinic.lat ?? undefined,
    lng: clinic.lng ?? undefined,
    territoryId: clinic.territoryId ?? undefined,
    territoryAssignmentStatus: clinic.territoryAssignmentStatus,
    professionalCount: clinic.professionalCount ?? 0,
    consultantName: clinic.consultantName ?? null,
    distanceKm: clinic.distanceKm ?? undefined,
    services: clinic.services ?? [],
    createdAt: clinic.createdAt.toISOString(),
    updatedAt: clinic.updatedAt.toISOString()
  }
}

interface Dependencies {
  facilityRepository: FacilityRepository
  facilityGeocodingService?: FacilityGeocodingService
  onFacilityLocationChanged?: (facilityId: string) => Promise<void>
}

export class ListFacilitiesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    page?: number
    limit?: number
    search?: string
    latitude?: number
    longitude?: number
    radiusKm?: number
    commercialStatus?: 'REGISTERED' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
    productIds?: string[]
    scope: ScopeContext
  }) {
    const page = input.page ?? 1
    const limit = input.limit ?? 20

    const { facilities, total } = await this.deps.facilityRepository.findAll({
      page,
      limit,
      search: input.search,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      commercialStatus: input.commercialStatus,
      productIds: input.productIds,
      scope: input.scope.isGlobal
        ? { isGlobal: true }
        : { isGlobal: false, facilityIds: input.scope.facilityIds }
    })

    return {
      data: facilities.map(serializeClinic),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    }
  }
}

export class GetFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    const clinic = await this.deps.facilityRepository.findById(input.facilityId)

    if (!clinic) {
      return null
    }

    assertResourceInScope(input.scope, 'facility', clinic.id)

    return serializeClinic(clinic)
  }
}

export class CreateFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { name: string; lat?: number; lng?: number }) {
    const coordinates = this.deps.facilityGeocodingService
      ? await this.deps.facilityGeocodingService.resolveCoordinates({
          lat: input.lat,
          lng: input.lng
        })
      : { lat: input.lat ?? null, lng: input.lng ?? null, geocoded: false }

    const clinic = await this.deps.facilityRepository.create({
      name: input.name,
      lat: coordinates.lat,
      lng: coordinates.lng
    })

    if (coordinates.lat != null && coordinates.lng != null) {
      await this.deps.onFacilityLocationChanged?.(clinic.id)
    }

    const refreshed = await this.deps.facilityRepository.findById(clinic.id)
    return serializeClinic(refreshed ?? clinic)
  }
}

export class UpdateFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string
    scope: ScopeContext
    name?: string
    lat?: number | null
    lng?: number | null
  }) {
    assertResourceInScope(input.scope, 'facility', input.facilityId)

    const existing = await this.deps.facilityRepository.findById(input.facilityId)
    if (!existing) {
      return null
    }

    const coordinates = this.deps.facilityGeocodingService
      ? await this.deps.facilityGeocodingService.resolveCoordinates({
          lat: input.lat !== undefined ? input.lat : existing.lat,
          lng: input.lng !== undefined ? input.lng : existing.lng
        })
      : {
          lat: input.lat !== undefined ? input.lat : existing.lat,
          lng: input.lng !== undefined ? input.lng : existing.lng,
          geocoded: false
        }

    const locationChanged = coordinates.lat !== existing.lat || coordinates.lng !== existing.lng

    const clinic = await this.deps.facilityRepository.update(input.facilityId, {
      name: input.name,
      lat: coordinates.lat,
      lng: coordinates.lng,
      manuallyEditedAt: new Date()
    })

    if (locationChanged) {
      await this.deps.onFacilityLocationChanged?.(clinic.id)
    }

    const refreshed = await this.deps.facilityRepository.findById(clinic.id)
    return serializeClinic(refreshed ?? clinic)
  }
}

export class DeleteFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    assertResourceInScope(input.scope, 'facility', input.facilityId)

    const existing = await this.deps.facilityRepository.findById(input.facilityId)
    if (!existing) {
      return false
    }

    await this.deps.facilityRepository.softDelete(input.facilityId)
    return true
  }
}
