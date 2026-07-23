import { z } from "zod";
import { optionalCpfSchema } from "./professional.schema";

export const purchaseStatusEnum = z.enum(["NAO_COMPRA", "COMPRA", "COMPRA_POUCO", "COMPRA_MUITO"]);

export const facilityTaxIdTypeSchema = z.enum(["PJ", "PF"]);

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const optionalCnpjSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => value === undefined || value === "" || digitsOnly(value).length === 14,
    { message: "Invalid CNPJ" }
  );

export const listFacilitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional(),
});

export const createFacilitySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    legalName: z.string().trim().max(200).optional(),
    tradeName: z.string().trim().max(200).optional(),
    taxIdType: facilityTaxIdTypeSchema.optional(),
    cnpj: optionalCnpjSchema,
    cpf: optionalCpfSchema,
    streetAddress: z.string().trim().max(200).optional(),
    streetNumber: z.string().trim().max(30).optional(),
    addressComplement: z.string().trim().max(100).optional(),
    neighborhood: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().length(2).optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
    phoneNumber: z.string().trim().max(30).optional(),
    whatsappNumber: z.string().trim().max(30).optional(),
    email: z
      .string()
      .trim()
      .optional()
      .refine((value) => value === undefined || value === "" || z.string().email().safeParse(value).success, {
        message: "Invalid email",
      }),
    /** @deprecated Prefer structured address fields. Kept for web clients. */
    address: z.string().trim().max(500).optional(),
    /** @deprecated Prefer `state`. */
    stateCode: z.string().trim().length(2).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .superRefine((value, ctx) => {
    const taxIdType = value.taxIdType ?? (value.cnpj ? "PJ" : value.cpf ? "PF" : undefined);
    if (taxIdType === "PJ" && value.cnpj && digitsOnly(value.cnpj).length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid CNPJ",
        path: ["cnpj"],
      });
    }
    if (taxIdType === "PF" && value.cpf === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid CPF",
        path: ["cpf"],
      });
    }
  });

export const updateFacilitySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  stateCode: z.string().trim().length(2).optional().nullable(),
  cnpj: z.string().trim().max(18).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  purchaseStatus: purchaseStatusEnum.optional().nullable(),
});

export type ListClinicsQuery = z.infer<typeof listFacilitiesQuerySchema>;
export type CreateClinicInput = z.infer<typeof createFacilitySchema>;
export type UpdateClinicInput = z.infer<typeof updateFacilitySchema>;
export type PurchaseStatus = z.infer<typeof purchaseStatusEnum>;
