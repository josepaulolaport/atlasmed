import { z } from "zod";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

function isValidCpf(value: string): boolean {
  const cpf = digitsOnly(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calcDigit = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i += 1) {
      sum += Number(cpf[i]) * (slice + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10]);
}

export const cpfSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isValidCpf, { message: "Invalid CPF" });

export const optionalCpfSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || value === "" || isValidCpf(value), {
    message: "Invalid CPF",
  });

export const relationshipLevelSchema = z.number().int().min(1).max(10);

export const listProfessionalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).optional(),
  facilityId: z.string().trim().min(1).optional(),
});

const professionalPersonFieldsSchema = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(1).max(200).optional(),
  socialName: z.string().trim().max(200).optional(),
  taxId: optionalCpfSchema,
  birthDate: z.string().date().optional(),
  mobilePhone: z.string().trim().max(30).optional(),
  landlinePhone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional(),
  websiteUrl: z.string().trim().url().optional(),
  imageUrl: z.string().trim().url().optional(),
  primarySpecialtyLabel: z.string().trim().max(200).optional(),
  crmCouncil: z.string().trim().max(20).optional(),
  crmNumber: z.string().trim().max(30).optional(),
  crmState: z.string().trim().length(2).optional(),
  favoriteTeam: z.string().trim().max(100).optional(),
  favoriteSport: z.string().trim().max(100).optional(),
  hobbies: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
};

/** @deprecated Use createProfessionalSchema */
export const createDoctorSchema = z.object({
  ...professionalPersonFieldsSchema,
  specialty: z.string().trim().max(200).optional(),
  facilityIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export const createProfessionalSchema = createDoctorSchema;

/** @deprecated Use updateProfessionalSchema */
export const updateDoctorSchema = z.object({
  firstName: professionalPersonFieldsSchema.firstName.optional(),
  lastName: professionalPersonFieldsSchema.lastName.optional(),
  fullName: professionalPersonFieldsSchema.fullName.nullable().optional(),
  socialName: professionalPersonFieldsSchema.socialName.nullable().optional(),
  taxId: optionalCpfSchema.nullable().optional(),
  birthDate: professionalPersonFieldsSchema.birthDate.nullable().optional(),
  mobilePhone: professionalPersonFieldsSchema.mobilePhone.nullable().optional(),
  landlinePhone: professionalPersonFieldsSchema.landlinePhone.nullable().optional(),
  email: professionalPersonFieldsSchema.email.nullable().optional(),
  websiteUrl: professionalPersonFieldsSchema.websiteUrl.nullable().optional(),
  imageUrl: professionalPersonFieldsSchema.imageUrl.nullable().optional(),
  primarySpecialtyLabel: professionalPersonFieldsSchema.primarySpecialtyLabel
    .nullable()
    .optional(),
  specialty: z.string().trim().max(200).nullable().optional(),
  crmCouncil: professionalPersonFieldsSchema.crmCouncil.nullable().optional(),
  crmNumber: professionalPersonFieldsSchema.crmNumber.nullable().optional(),
  crmState: professionalPersonFieldsSchema.crmState.nullable().optional(),
  favoriteTeam: professionalPersonFieldsSchema.favoriteTeam.nullable().optional(),
  favoriteSport: professionalPersonFieldsSchema.favoriteSport.nullable().optional(),
  hobbies: professionalPersonFieldsSchema.hobbies.nullable().optional(),
  notes: professionalPersonFieldsSchema.notes.nullable().optional(),
  facilityIds: z.array(z.string().trim().min(1)).min(1).optional(),
});

export const updateProfessionalSchema = updateDoctorSchema;

export const updateFacilityProfessionalSchema = z.object({
  isPartner: z.boolean().optional(),
  isPrescriber: z.boolean().optional(),
  isBuyer: z.boolean().optional(),
  isDecisionMaker: z.boolean().optional(),
  relationshipLevel: relationshipLevelSchema.nullable().optional(),
  specialtyLabel: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type ListProfessionalsQuery = z.infer<typeof listProfessionalsQuerySchema>;
export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;
export type UpdateFacilityProfessionalInput = z.infer<
  typeof updateFacilityProfessionalSchema
>;

/** @deprecated Use CreateProfessionalInput */
export type CreateDoctorInput = CreateProfessionalInput;
/** @deprecated Use UpdateProfessionalInput */
export type UpdateDoctorInput = UpdateProfessionalInput;

export interface ProfessionalFacilitySummary {
  id: string;
  name: string;
}

export interface ProfessionalProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  socialName?: string;
  taxId?: string;
  birthDate?: string;
  mobilePhone?: string;
  landlinePhone?: string;
  email?: string;
  websiteUrl?: string;
  imageUrl?: string;
  primarySpecialtyLabel?: string;
  specialty?: string;
  crmCouncil?: string;
  crmNumber?: string;
  crmState?: string;
  favoriteTeam?: string;
  favoriteSport?: string;
  hobbies?: string;
  notes?: string;
  facilityIds: string[];
  facilities: ProfessionalFacilitySummary[];
  createdAt: string;
  updatedAt: string;
}

export interface FacilityProfessionalRole {
  facilityProfessionalId: string;
  facilityId: string;
  professionalId: string;
  occupationCode: string;
  isPartner: boolean;
  isPrescriber: boolean;
  isBuyer: boolean;
  isDecisionMaker: boolean;
  relationshipLevel?: number;
  specialtyLabel?: string;
  notes?: string;
}

export interface ProfessionalFacilityContext {
  professional: ProfessionalProfile;
  association: FacilityProfessionalRole;
  facilities: ProfessionalFacilitySummary[];
}
