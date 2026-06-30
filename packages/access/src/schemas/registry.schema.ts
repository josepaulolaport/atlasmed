import { z } from "zod";

export const facilityProfessionalViewSchema = z.enum([
  "source",
  "confirmed",
  "pending",
  "all",
]);

export const listFacilityProfessionalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional(),
  view: facilityProfessionalViewSchema.optional(),
});

export const ingestionSuggestionTypeSchema = z.enum([
  "FACILITY_FIELD_UPDATE",
  "FACILITY_REGISTRY_DEACTIVATED",
  "FACILITY_REGISTRY_REACTIVATED",
  "FACILITY_PROFESSIONAL_REMOVAL",
  "FACILITY_PROFESSIONAL_ADD",
  "FACILITY_REPRESENTATIVE_REMOVAL",
  "FACILITY_REPRESENTATIVE_ADD",
  "FACILITY_REPRESENTATIVE_FIELD_UPDATE",
  "CLINIC_REMOVAL",
  "CLINIC_REACTIVATION",
  "DOCTOR_CLINIC_REMOVAL",
]);

export const listSuggestionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED", "SUPERSEDED"]).optional(),
  type: ingestionSuggestionTypeSchema.optional(),
});

export const resolveSuggestionSchema = z.object({
  resolutionNote: z.string().trim().max(500).optional(),
});

export type FacilityProfessionalView = z.infer<typeof facilityProfessionalViewSchema>;
export type ListFacilityProfessionalsQuery = z.infer<typeof listFacilityProfessionalsQuerySchema>;
export type ListSuggestionsQuery = z.infer<typeof listSuggestionsQuerySchema>;
export type ResolveSuggestionInput = z.infer<typeof resolveSuggestionSchema>;
