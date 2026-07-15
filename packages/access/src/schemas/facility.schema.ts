import { z } from 'zod'

export const purchaseStatusEnum = z.enum(['NAO_COMPRA', 'COMPRA', 'COMPRA_POUCO', 'COMPRA_MUITO'])

export const listFacilitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional()
})

export const createFacilitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  stateCode: z.string().trim().length(2).optional(),
  cnpj: z.string().trim().max(18).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  purchaseStatus: purchaseStatusEnum.optional()
})

export const updateFacilitySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  stateCode: z.string().trim().length(2).optional().nullable(),
  cnpj: z.string().trim().max(18).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  purchaseStatus: purchaseStatusEnum.optional().nullable()
})

export type ListClinicsQuery = z.infer<typeof listFacilitiesQuerySchema>
export type CreateClinicInput = z.infer<typeof createFacilitySchema>
export type UpdateClinicInput = z.infer<typeof updateFacilitySchema>
export type PurchaseStatus = z.infer<typeof purchaseStatusEnum>
