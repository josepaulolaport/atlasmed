import { z } from "zod";

export const doctorClinicViewSchema = z.enum([
  "source",
  "confirmed",
  "pending",
  "all",
]);

export const listClinicDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional(),
  view: doctorClinicViewSchema.optional(),
});

export const listSuggestionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED", "SUPERSEDED"]).optional(),
  type: z
    .enum(["CLINIC_REMOVAL", "CLINIC_REACTIVATION", "DOCTOR_CLINIC_REMOVAL"])
    .optional(),
});

export const resolveSuggestionSchema = z.object({
  resolutionNote: z.string().trim().max(500).optional(),
});

export type DoctorClinicView = z.infer<typeof doctorClinicViewSchema>;
export type ListClinicDoctorsQuery = z.infer<typeof listClinicDoctorsQuerySchema>;
export type ListSuggestionsQuery = z.infer<typeof listSuggestionsQuerySchema>;
export type ResolveSuggestionInput = z.infer<typeof resolveSuggestionSchema>;
