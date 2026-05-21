import { z } from "zod";

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
