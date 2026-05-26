import { z } from "zod";

export const assignUserManagerSchema = z.object({
  managerId: z.string().min(1).nullable(),
});

export type AssignUserManagerInput = z.infer<typeof assignUserManagerSchema>;

export const assignUserTerritorySchema = z.object({
  territoryId: z.string().min(1),
});

export type AssignUserTerritoryInput = z.infer<typeof assignUserTerritorySchema>;
