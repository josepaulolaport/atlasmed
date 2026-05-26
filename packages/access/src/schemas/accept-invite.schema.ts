import { z } from "zod";

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
