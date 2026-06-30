import { z } from "zod";

export const inviteTokenSchema = z.object({
  token: z.string().min(1, "Registration token is required"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Username, email or phone is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
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

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  phoneNumber: z.string().optional(),
  roleId: z.string().min(1, "Role is required"),
}).refine((data) => data.email || data.phoneNumber, {
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
    "USER",
    "FACILITY",
    "PROFESSIONAL",
    "VISIT",
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
