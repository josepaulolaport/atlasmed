import { z } from "zod";

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional(),
  clinicId: z.string().trim().min(1).optional(),
});

export const createDoctorSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  specialty: z.string().trim().max(200).optional(),
  clinicIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export const updateDoctorSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  specialty: z.string().trim().max(200).nullable().optional(),
  clinicIds: z.array(z.string().trim().min(1)).min(1).optional(),
});

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
