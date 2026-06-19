import { z } from "zod";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"]).optional(),
  search: z.string().min(1).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
