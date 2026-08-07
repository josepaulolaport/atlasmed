import { z } from "zod";

export const changeUserRoleSchema = z.object({
  roleId: z.number().int().positive(),
});

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
