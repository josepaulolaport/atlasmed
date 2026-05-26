import { z } from "zod";

export const changeUserRoleSchema = z.object({
  roleId: z.string().min(1),
});

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
