import { ValidationError } from '../../../shared/errors'

export interface ListProfessionalsQuery {
  latitude?: number
  longitude?: number
  radiusKm?: number
  specialty?: string
}

export function parseListProfessionalsQuery(
  query: Record<string, unknown>
): ListProfessionalsQuery {
  const latitude = query.latitude === undefined ? undefined : Number(query.latitude)
  const longitude = query.longitude === undefined ? undefined : Number(query.longitude)
  const radiusKm = query.radiusKm === undefined ? undefined : Number(query.radiusKm)
  const specialty =
    typeof query.specialty === 'string' && query.specialty.trim()
      ? query.specialty.trim()
      : undefined
  const issues: Array<{ field: string; message: string }> = []
  if ((latitude === undefined) !== (longitude === undefined))
    issues.push({
      field: 'coordinates',
      message: 'latitude and longitude must be provided together'
    })
  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    issues.push({ field: 'latitude', message: 'latitude must be between -90 and 90' })
  if (
    longitude !== undefined &&
    (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
  )
    issues.push({ field: 'longitude', message: 'longitude must be between -180 and 180' })
  if (radiusKm !== undefined && (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500))
    issues.push({ field: 'radiusKm', message: 'radiusKm must be greater than 0 and at most 500' })
  if (radiusKm !== undefined && latitude === undefined)
    issues.push({
      field: 'radiusKm',
      message: 'latitude and longitude are required when radiusKm is provided'
    })
  if (query.specialty !== undefined && !specialty)
    issues.push({ field: 'specialty', message: 'specialty cannot be blank' })
  if (issues.length > 0) throw new ValidationError(issues)
  return { latitude, longitude, radiusKm, specialty }
}
