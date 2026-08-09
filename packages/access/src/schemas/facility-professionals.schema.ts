import { z } from "zod";

export const facilityProfessionalViewSchema = z.enum([
  "confirmed",
  "all",
]);

export const listFacilityProfessionalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional(),
  view: facilityProfessionalViewSchema.optional(),
});

export type FacilityProfessionalView = z.infer<typeof facilityProfessionalViewSchema>;
export type ListFacilityProfessionalsQuery = z.infer<typeof listFacilityProfessionalsQuerySchema>;
