import { z } from "zod";

export const listClinicsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional(),
});

export const createClinicSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  territoryId: z.string().trim().min(1).optional(),
});

export const updateClinicSchema = createClinicSchema.partial();

export type ListClinicsQuery = z.infer<typeof listClinicsQuerySchema>;
export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
