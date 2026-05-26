import { z } from "zod";

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
  password: z.string().min(1, "Password is required"),
});

export const changePhoneSchema = z.object({
  newPhoneNumber: z.string().min(1, "Phone number is required"),
  password: z.string().min(1, "Password is required"),
});
