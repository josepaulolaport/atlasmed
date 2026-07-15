export type FieldOwnership = 'SOURCE_TRACKED' | 'CRM_OWNED' | 'DERIVED'

export const FACILITY_SOURCE_TRACKED_FIELDS = [
  'displayName',
  'address',
  'lat',
  'lng',
  'legalName',
  'tradeName',
  'streetAddress',
  'streetNumber',
  'addressComplement',
  'neighborhood',
  'postalCode',
  'phoneNumber',
  'email',
  'referenceMunicipalityCode'
] as const

export const PROFESSIONAL_SOURCE_TRACKED_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'specialty',
  'taxId',
  'email',
  'mobilePhone'
] as const

export const REPRESENTATIVE_SOURCE_TRACKED_FIELDS = [
  'representativeName',
  'roleTitle',
  'email',
  'taxId'
] as const
