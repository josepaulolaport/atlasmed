import { z } from "zod";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  revokeOtherSessions: z.boolean().optional().default(true),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
