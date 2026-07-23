import { z } from "zod";

export const updateUserAsAdminSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1).nullable().optional(),
  username: z.string().min(3).optional(),
  /** ISO date string (YYYY-MM-DD or full ISO) or null to clear. */
  birthDate: z.union([z.string().min(1), z.null()]).optional(),
});

export type UpdateUserAsAdminInput = z.infer<typeof updateUserAsAdminSchema>;
