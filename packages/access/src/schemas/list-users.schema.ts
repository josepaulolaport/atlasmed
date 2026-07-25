import { z } from "zod";

export const listUsersSortBySchema = z.enum(["name", "role", "status", "createdAt"]);
export const listUsersSortDirSchema = z.enum(["asc", "desc"]);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"]).optional(),
  role: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  verticalId: z.string().min(1).optional(),
  sortBy: listUsersSortBySchema.optional(),
  sortDir: listUsersSortDirSchema.optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListUsersSortBy = z.infer<typeof listUsersSortBySchema>;
export type ListUsersSortDir = z.infer<typeof listUsersSortDirSchema>;
