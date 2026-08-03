import {
  createProfessionalSchema,
  updateFacilityProfessionalSchema,
  updateProfessionalSchema,
} from "@atlasmed/access";
import { z } from "zod";

export const inviteTokenSchema = z.object({
  token: z.string().min(1, "Registration token is required"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Username, email or phone is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  token: z.string().min(1, "Token de convite é obrigatório"),
  email: z.string().email("Email inválido"),
  phoneNumber: z.string().optional(),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter um número")
    .regex(/[^A-Za-z0-9]/, "Senha deve conter um caractere especial"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida"),
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().min(1, "Email, username or phone is required"),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const inviteUserSchema = z
  .object({
    email: z.string().email("Invalid email address").optional(),
    phoneNumber: z.string().optional(),
    roleId: z.string().min(1, "Role is required"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD"),
    verticalAssignments: z
      .array(
        z.object({
          verticalId: z.string().min(1),
          territoryIds: z.array(z.string().min(1)).default([]),
        }),
      )
      .optional(),
  })
  .refine((data) => data.email || data.phoneNumber, {
    message: "Either email or phone number is required",
    path: ["email"],
  });

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().url("Invalid URL").optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const verifyPhoneSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
});

export const changeEmailConfirmSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
  token: z.string().min(1, "Confirmation token is required"),
});

export const changePhoneSchema = z.object({
  newPhone: z.string().min(1, "Phone number is required"),
});

export const changePhoneConfirmSchema = z.object({
  newPhone: z.string().min(1, "Phone number is required"),
  token: z.string().min(1, "Verification code is required"),
});

export const passwordFieldSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordFieldSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
    revokeOtherSessions: z.boolean().optional(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const totpCodeSchema = z
  .string()
  .length(6, "Enter the 6-digit code from your authenticator app")
  .regex(/^\d+$/, "Code must contain only digits");

export const disable2FASchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: totpCodeSchema,
});

export const grantPermissionSchema = z.object({
  resource: z.enum([
    "REP",
    "FACILITY",
    "PROFESSIONAL",
    "TERRITORY",
    "INVITATION",
  ]),
  action: z.enum(["create", "read", "update", "delete", "manage"]),
  resourceId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const changeUserRoleSchema = z.object({
  roleId: z.string().min(1, "Role is required"),
});

export const createProfessionalFormSchema = createProfessionalSchema;
export const updateProfessionalFormSchema = updateProfessionalSchema;
export const updateFacilityProfessionalFormSchema = updateFacilityProfessionalSchema;
