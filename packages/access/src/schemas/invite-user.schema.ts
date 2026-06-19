import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  roleId: z.string(),
}).refine(
  (data) => data.email || data.phoneNumber,
  {
    message: "Either email or phone number is required",
    path: ["email"],
  }
);

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
