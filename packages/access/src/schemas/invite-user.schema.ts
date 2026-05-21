import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.email().optional(),

  phoneNumber: z.string().optional(),

  roleId: z.string(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
